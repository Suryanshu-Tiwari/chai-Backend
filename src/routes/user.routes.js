import { Router } from "express";
import {loginUser, registerUser, logoutUser} from "../controllers/user.controller.js";
import upload from "../middlewares/multer.middleware.js"
import jwt from "jsonwebtoken";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router()

router.route("/register").post(
    upload.fields([
        {
            name:"avatar",
            maxcount:1
        },{
            name:"coverImage",
            macxount: 1
        }
    ]),
    registerUser
    )
    router.route("/login").post(loginUser)
// router.route("/login").post(registerUser)
//secured router
router.route("/logout").post(verifyJWT, logoutUser)

export default router