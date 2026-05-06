import {
  adminAuth,
  db,
  FieldValue,
  functionsV1,
  isUserRole,
  UserRole,
} from "../lib/shared.js";

// ── onUserCreated: mirror Firebase Auth user → Firestore users/{uid} ──────────
// The first mirrored user becomes admin for bootstrap. Later users do not receive
// an automatic staff role; they must be created through createUser by an admin.
// Custom Claims are set so Firestore/Storage rules can use request.auth.token.role.
export const onUserCreated = functionsV1
  .region("southamerica-east1")
  .auth.user()
  .onCreate(async (user) => {
    const docRef = db.collection("users").doc(user.uid);
    const adminQuery = db
      .collection("users")
      .where("role", "==", "admin")
      .limit(1);

    let roleToSet: UserRole | null = null;

    await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(docRef);

      if (existing.exists) {
        // Already mirrored — still sync Custom Claims
        const existingRole = existing.data()?.role;
        if (isUserRole(existingRole)) roleToSet = existingRole;
        return;
      }

      const adminUsers = await transaction.get(adminQuery);
      if (!adminUsers.empty) {
        return;
      }

      transaction.set(docRef, {
        uid: user.uid,
        email: user.email ?? "",
        displayName: user.displayName ?? user.email?.split("@")[0] ?? "",
        role: "admin",
        createdAt: FieldValue.serverTimestamp(),
        createdBy: "system",
        roleUpdatedAt: FieldValue.serverTimestamp(),
        roleUpdatedBy: "system",
        roleUpdatedByLabel: "Sistema",
      });
      roleToSet = "admin";
    });

    if (roleToSet) {
      await adminAuth.setCustomUserClaims(user.uid, { role: roleToSet });
    }
  });
