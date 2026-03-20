import {initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {FieldValue, getFirestore} from "firebase-admin/firestore";
import {setGlobalOptions} from "firebase-functions/v2";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import * as functionsV1 from "firebase-functions/v1";

initializeApp();
setGlobalOptions({maxInstances: 10, region: "southamerica-east1"});

const db = getFirestore();
const adminAuth = getAuth();

type UserRole = "admin" | "reviewer";
type ApplicationStatus =
  | "pending"
  | "in_review"
  | "approved"
  | "rejected"
  | "withdrawn";
type AnimalStatus = "available" | "under_review" | "adopted" | "archived";

// ── Helpers ───────────────────────────────────────────────────────────────────

function isUserRole(value: unknown): value is UserRole {
  return value === "admin" || value === "reviewer";
}

async function getCallerRole(uid: string): Promise<UserRole | null> {
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) return null;
  const role = snap.data()?.role;
  return isUserRole(role) ? role : null;
}

// ── onUserCreated: mirror Firebase Auth user → Firestore users/{uid} ──────────
// The first mirrored user becomes admin. Later users default to reviewer unless
// another trusted path assigns a different role.
export const onUserCreated = functionsV1.region("southamerica-east1").auth.user().onCreate(async (user) => {
  const docRef = db.collection("users").doc(user.uid);
  const adminQuery = db.collection("users").where("role", "==", "admin").limit(1);

  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(docRef);
    if (existing.exists) return;

    const adminUsers = await transaction.get(adminQuery);
    const role: UserRole = adminUsers.empty ? "admin" : "reviewer";

    transaction.set(docRef, {
      uid: user.uid,
      email: user.email ?? "",
      displayName: user.displayName ?? user.email?.split("@")[0] ?? "",
      role,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: "system",
    });
  });
});

// ── createUser: admin creates a new staff user ────────────────────────────────
export const createUser = onCall(
  {region: "southamerica-east1"},
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Not authenticated.");
    }

    const callerRole = await getCallerRole(request.auth.uid);
    if (callerRole !== "admin") {
      throw new HttpsError("permission-denied", "Only admins can create users.");
    }

    const {email, password, displayName, role} = request.data as {
      email: string;
      password: string;
      displayName: string;
      role: UserRole;
    };

    if (!email || !password || !displayName || !role) {
      throw new HttpsError("invalid-argument", "Missing required fields.");
    }
    if (!isUserRole(role)) {
      throw new HttpsError("invalid-argument", "Invalid role.");
    }
    if (password.length < 6) {
      throw new HttpsError(
        "invalid-argument",
        "Password must be at least 6 characters."
      );
    }

    const newUser = await adminAuth.createUser({email, password, displayName});

    await db.collection("users").doc(newUser.uid).set({
      uid: newUser.uid,
      email,
      displayName,
      role,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: request.auth.uid,
    });

    return {uid: newUser.uid};
  }
);

// ── updateUserRole: admin promotes or demotes another user ────────────────────
export const updateUserRole = onCall(
  {region: "southamerica-east1"},
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Not authenticated.");
    }

    const callerRole = await getCallerRole(request.auth.uid);
    if (callerRole !== "admin") {
      throw new HttpsError(
        "permission-denied",
        "Only admins can update roles."
      );
    }

    const {uid, role} = request.data as {uid: string; role: UserRole};

    if (!uid || !isUserRole(role)) {
      throw new HttpsError("invalid-argument", "Invalid arguments.");
    }
    if (uid === request.auth.uid) {
      throw new HttpsError(
        "failed-precondition",
        "You cannot change your own role."
      );
    }

    await db.collection("users").doc(uid).update({
      role,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {success: true};
  }
);

// ── onApplicationStatusChanged: sync animal status when application changes ───
export const onApplicationStatusChanged = onDocumentWritten(
  {document: "applications/{appId}", region: "southamerica-east1"},
  async (event) => {
    const before = event.data?.before.data() as
      | {status: ApplicationStatus; animalId?: string}
      | undefined;
    const after = event.data?.after.data() as
      | {status: ApplicationStatus; animalId?: string}
      | undefined;

    if (!after) return; // document deleted
    if (before?.status === after.status) return; // status unchanged

    const animalId = after.animalId;
    if (!animalId) return; // general adoption form — no specific animal

    const animalRef = db.collection("animals").doc(animalId);

    let newAnimalStatus: AnimalStatus | null = null;

    if (after.status === "in_review") {
      newAnimalStatus = "under_review";
    } else if (after.status === "approved") {
      newAnimalStatus = "adopted";
    } else if (after.status === "rejected" || after.status === "withdrawn") {
      // Only revert animal to available if no other active applications remain
      const activeApps = await db
        .collection("applications")
        .where("animalId", "==", animalId)
        .where("status", "in", ["pending", "in_review"])
        .get();

      if (activeApps.empty) {
        newAnimalStatus = "available";
      }
    }

    if (newAnimalStatus) {
      await animalRef.update({
        status: newAnimalStatus,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }
);
