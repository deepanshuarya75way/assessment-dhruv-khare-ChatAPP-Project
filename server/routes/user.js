import express from "express";
import {
  acceptFriendReq,
  getAllNotifications,
  getMyFriends,
  getMyProfile,
  login,
  logout,
  newUser,
  searchUser,
  sendFriendrequest,
  savePublicKey,
  getPublicKey
} from "../controllers/user.js";
import { singleAvatar } from "../middlewares/multer.js";
import { isAuthenticatd } from "../middlewares/auth.js";
import { acceptFriendReqValidator, loginValidator, registerValidator, sendAttatchementValidator, sendFriendReqValidator, validate } from "../lib/validators.js";

const app = express.Router();

app.post("/new", singleAvatar,registerValidator(),validate, newUser);
app.post("/login", loginValidator(),validate, login);

// after this all should be authenticatd
app.use(isAuthenticatd);
app.get("/me", getMyProfile);
app.get("/logout", logout);
app.get("/search", searchUser);
app.put("/send-request",sendFriendReqValidator(),validate, sendFriendrequest);
app.put("/accept-request",acceptFriendReqValidator(),validate, acceptFriendReq);

app.get("/allNotifications",getAllNotifications);

app.get("/friends",getMyFriends);
app.put("/public-key",savePublicKey);
app.get("/public-key/:id",getPublicKey);

export default app;
