import {
  adminAuth,
  assertAdminRateLimit,
  db,
  FieldValue,
  getActorLabel,
  HttpsError,
  isUserRole,
  isValidEmail,
  logOperationError,
  logOperationStart,
  logOperationSuccess,
  logPermissionDenied,
  onCall,
  safeRole,
  UserRole,
} from "../lib/shared.js";

// ── createUser: admin creates a new staff user ────────────────────────────────
export const createUser = onCall(
  { region: "southamerica-east1", maxInstances: 3 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Not authenticated.");
    }

    // Melhoria 3: use token claim instead of a Firestore read
    const callerRole = request.auth.token?.role;
    if (callerRole !== "admin") {
      logPermissionDenied("user.create", request.auth.uid, callerRole);
      throw new HttpsError("permission-denied", "Only admins can create users.");
    }

    await assertAdminRateLimit(request.auth.uid, "user.create");

    const { email, password, displayName, role } = request.data as {
      email: string;
      password: string;
      displayName: string;
      role: UserRole;
    };

    if (!email || !password || !displayName || !role) {
      throw new HttpsError("invalid-argument", "Missing required fields.");
    }
    if (!isValidEmail(email)) {
      throw new HttpsError("invalid-argument", "Invalid email format.");
    }
    if (!isUserRole(role)) {
      throw new HttpsError("invalid-argument", "Invalid role.");
    }
    if (password.length < 8) {
      throw new HttpsError("invalid-argument", "Senha deve ter ao menos 8 caracteres.");
    }
    if (!/[A-Z]/.test(password)) {
      throw new HttpsError("invalid-argument", "Senha deve conter ao menos uma letra maiúscula.");
    }
    if (!/[a-z]/.test(password)) {
      throw new HttpsError("invalid-argument", "Senha deve conter ao menos uma letra minúscula.");
    }
    if (!/[0-9]/.test(password)) {
      throw new HttpsError("invalid-argument", "Senha deve conter ao menos um número.");
    }

    logOperationStart({
      operation: "user.create",
      uid: request.auth.uid,
      actorRole: safeRole(callerRole),
      status: role,
    });

    let newUserUid: string | undefined;
    try {
      const actorLabel = getActorLabel(request.auth);
      const newUser = await adminAuth.createUser({ email, password, displayName });
      newUserUid = newUser.uid;
      const userPayload: Record<string, unknown> = {
        uid: newUser.uid,
        email,
        displayName,
        role,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: request.auth.uid,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: request.auth.uid,
        roleUpdatedAt: FieldValue.serverTimestamp(),
        roleUpdatedBy: request.auth.uid,
      };
      if (actorLabel) {
        userPayload.updatedByLabel = actorLabel;
        userPayload.roleUpdatedByLabel = actorLabel;
      }

      try {
        await db.collection("users").doc(newUser.uid).set(userPayload);
        await adminAuth.setCustomUserClaims(newUser.uid, { role });
      } catch (err) {
        await Promise.allSettled([
          adminAuth.deleteUser(newUser.uid),
          db.collection("users").doc(newUser.uid).delete(),
        ]);
        throw err;
      }

      logOperationSuccess({
        operation: "user.create",
        uid: request.auth.uid,
        actorRole: safeRole(callerRole),
        targetId: newUser.uid,
        status: role,
      });

      return { uid: newUser.uid };
    } catch (err) {
      logOperationError(err, {
        operation: "user.create",
        uid: request.auth.uid,
        actorRole: safeRole(callerRole),
        targetId: newUserUid,
        status: role,
      });
      throw err;
    }
  }
);

// ── updateUserRole: admin promotes or demotes another user ────────────────────
export const updateUserRole = onCall(
  { region: "southamerica-east1", maxInstances: 3 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Not authenticated.");
    }

    const callerRole = request.auth.token?.role;
    if (callerRole !== "admin") {
      logPermissionDenied("user.role.update", request.auth.uid, callerRole);
      throw new HttpsError(
        "permission-denied",
        "Only admins can update roles."
      );
    }

    await assertAdminRateLimit(request.auth.uid, "user.role.update");

    const { uid, role } = request.data as { uid: string; role: UserRole };

    if (!uid || !isUserRole(role)) {
      throw new HttpsError("invalid-argument", "Invalid arguments.");
    }
    if (uid === request.auth.uid) {
      throw new HttpsError(
        "failed-precondition",
        "You cannot change your own role."
      );
    }

    logOperationStart({
      operation: "user.role.update",
      uid: request.auth.uid,
      actorRole: safeRole(callerRole),
      targetId: uid,
      status: role,
    });

    try {
      // Update Custom Claims first so Auth rules are consistent immediately
      await adminAuth.setCustomUserClaims(uid, { role });

      const actorLabel = getActorLabel(request.auth);
      const payload: Record<string, unknown> = {
        role,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: request.auth.uid,
        roleUpdatedAt: FieldValue.serverTimestamp(),
        roleUpdatedBy: request.auth.uid,
      };
      if (actorLabel) {
        payload.updatedByLabel = actorLabel;
        payload.roleUpdatedByLabel = actorLabel;
      }

      await db.collection("users").doc(uid).update(payload);

      logOperationSuccess({
        operation: "user.role.update",
        uid: request.auth.uid,
        actorRole: safeRole(callerRole),
        targetId: uid,
        status: role,
      });

      return { success: true };
    } catch (err) {
      logOperationError(err, {
        operation: "user.role.update",
        uid: request.auth.uid,
        actorRole: safeRole(callerRole),
        targetId: uid,
        status: role,
      });
      throw err;
    }
  }
);

// ── deleteUser: admin removes a staff user from Auth and Firestore ────────────
export const deleteUser = onCall(
  { region: "southamerica-east1", maxInstances: 3 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Not authenticated.");
    }

    const callerRole = request.auth.token?.role;
    if (callerRole !== "admin") {
      logPermissionDenied("user.delete", request.auth.uid, callerRole);
      throw new HttpsError("permission-denied", "Only admins can delete users.");
    }

    await assertAdminRateLimit(request.auth.uid, "user.delete");

    const { uid } = request.data as { uid: string };

    if (!uid || typeof uid !== "string") {
      throw new HttpsError("invalid-argument", "UID inválido.");
    }

    if (uid === request.auth.uid) {
      throw new HttpsError("failed-precondition", "Você não pode excluir sua própria conta.");
    }

    logOperationStart({
      operation: "user.delete",
      uid: request.auth.uid,
      actorRole: safeRole(callerRole),
      targetId: uid,
    });

    try {
      await adminAuth.deleteUser(uid);
      await db.collection("users").doc(uid).delete();

      logOperationSuccess({
        operation: "user.delete",
        uid: request.auth.uid,
        actorRole: safeRole(callerRole),
        targetId: uid,
      });

      return { success: true };
    } catch (err) {
      logOperationError(err, {
        operation: "user.delete",
        uid: request.auth.uid,
        actorRole: safeRole(callerRole),
        targetId: uid,
      });
      throw err;
    }
  }
);

// ── refreshUserClaims: sets Custom Claims for the calling user ────────────────
// Called automatically on login when the token has no role claim.
// Covers existing users who were created before Custom Claims were deployed.
export const refreshUserClaims = onCall(
  { region: "southamerica-east1", maxInstances: 5 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Not authenticated.");
    }

    const snap = await db.collection("users").doc(request.auth.uid).get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "User profile not found.");
    }

    const role = snap.data()?.role;
    if (!isUserRole(role)) {
      logPermissionDenied("user.claims.refresh", request.auth.uid, role);
      throw new HttpsError("permission-denied", "Invalid user role.");
    }

    await adminAuth.setCustomUserClaims(request.auth.uid, { role });
    return { role };
  }
);
