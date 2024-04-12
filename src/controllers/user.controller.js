import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js"
import User , { User } from"../models/user.model.js"
import uploadOnCloudinary from "../utils/cloudinary.js";
import ApiResponse from "../utils/ApiResponse.js";

const registerUser = asyncHandler (async (req, res) => {
    // get user details from front page
    // validation (! EMPTY)
    // CHECK IF ALREADY EXIST : username and email
    // check for images and then avatar
    // upload them to cloudinary
    // create user object - create entry in db
    // remove password and refresh token field fromm respnse
    // check for user creation
    // return response
    const {fullName ,email,username, password}=req.body
    console.log("email: ",email);

    if([fullName, email, username, password].some((field) => field?.trim()==="")
    ) {
        throw new ApiError(400,"All fields are required")
    }

    const existedUser = User.findOne({
        $or: [{ username },{ email }]
    })
    if (existedUser) {
        throw new ApiError(409,"This User is already exists")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if(!avatarLocalPath) {
        throw new ApiError(400,"Avatar is required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary (coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400,"Avatar is required");
    }

    const User = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage:coverImage?.url || "",
        email,
        password,
        username:username.toLowercase()
    })

    const createdUser = await User.findById(User._id).select(
        "-password -refreshToken"
    )

    if(!createdUser) {
        throw new ApiError(500," Something went wrong while registering User")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, " User registered Successfully")
    )

    // if(!avatarLocalPath) {
    //     throw new ApiError(400,"Avatar is required");
    // }
})

export {registerUser};