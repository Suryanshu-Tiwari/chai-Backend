import { User } from "../models/user.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import uploadOnCloudinary from "../utils/cloudinary.js";
import ApiResponse from "../utils/ApiResponse.js";
import jwt  from "jsonwebtoken";

    const generateAccessAndRefreshTokens = async(userId) => 
    {
        try {
            const user = await User.findById(userId)
            const accessToken = user.generateAccessToken()
            const refreshToken = user.generateRefreshToken()

            user.refreshToken =refreshToken
            await user.save({validateBeforeSave: false})

            return {accessToken, refreshToken}

        } catch (error) {
            throw new ApiError(500,"Something Went Wrong while generation refresh and access token")
        }
    }


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
    // console.log("email: ",email);

    if([fullName, email, username, password].some((field) => field?.trim()==="")
    ) {
        throw new ApiError(400,"All fields are required")
    }

    const existedUser =  await User.findOne({
        $or: [{ username },{ email }]
    })
    if (existedUser) {
        throw new ApiError(409,"This User is already exists")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length >0){
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if(!avatarLocalPath) {
        throw new ApiError(400,"Avatar is required");
    }

    const avatar = await uploadOnCloudinary (avatarLocalPath)
    const coverImage = await uploadOnCloudinary (coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400,"Avatar is required")
    }

    const newUser = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage:coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(newUser._id).select(
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

    const loginUser = asyncHandler(async (req, res) => {
        
        const {email, username, password} = req.body
        console.log("request body: ", req.body)
            
        if( !(username || email) ){
            throw new ApiError(400,"Username or email is Required")
        }
    
        const user = await User.findOne({$or: [{username},{email}]
        })

        if(!user){
            throw new ApiError(404,"User not Found");
        }
    
        const isPasswordValid = await user.isPasswordCorrect(password)
    
        if(!isPasswordValid){
            throw new ApiError(404,"Invalid Password");
        }
        
        const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)
    
        const loggedInUser=  await User.findById(user._id).select("-password -refreshToken")

        const options ={
            httpOnly: true,
            secure:  true
        }
        return res.status(200)
        .cookie("accessToken",accessToken, options)
        .cookie("refreshToken",refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser, accessToken, refreshToken
                    
                },
                "User LoggedIn Successfully"
            )
        )
    })
const logoutUser =asyncHandler(async(req, res)=>{
    User.findByIdAndUpdate(req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
        )
        const options ={
            httpOnly: true,
            secure:  true,
        }
        return res.status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse (200, {}, "User Logged Out"))
})

const refreshAccessToken = asyncHandler(async ( req, res)=> {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    
    if(!incomingRefreshToken) {
        throw new ApiError(401,"unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = User.findById(decodedToken?._id)
    
        if(!user) {
            throw new ApiError(401," Invalid Refresh token")
        }
        if(incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401,"Refresh token is expired or used")
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken",newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {accessToken, refreshToken: newRefreshToken},
                "Access Token Refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid Refresh Token")
    }
})

const changeCurrentPassword = asyncHandler(async(req, res) => {
    const{oldPassword, newPassword} = req.body

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
    if(isPasswordCorrect){
        throw new ApiError(400,"invalid old Password")

        user.password = newPassword
        await user.save({validateBeforeSafe: false})

        return res.status(200)
        .json(new ApiResponse(200,{},"Password changed Successfully"))

    }
})
const getCurrentUser = asyncHandler(async(req,res) =>{
    return res
    .status(200)
    .json(200,req.user,"current user fetched successfully")
})

const updateAccountDetails = asyncHandler(async(req,res)=>{
    const{fullName, email}=req.body

    if(!fullName || !email){
        throw new ApiError(400, "all fields are required")

    }
    const user = User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{ 
                fullName,
                email: email
            }
        },
        {new:true}
    ).select("-password")
    return res
        .status(200)
        .json(new ApiResponse(200, user ," Account details updated Successfully"))

})

const updateUserAvatar = asyncHandler(async(req, res)=>
{
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar is Required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400, "Error while uploading on avatar")
    }
    const user = await User.findByIdAndUpdate(
        req.usser?._id,
        {
            $set:{
                avatar :avatar.url
            }
        },
        {new:true}
    ).select ("-password")

    return res
    .status(200)
    .json( new ApiResponse(200, user, "Avatar updated Succeessfully"))
})
const updateUserCoverImage = asyncHandler(async(req, res)=>
{
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400, "Cover Image is Required")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(400, "Error while uploading on Cover Image")
    }
    const user = await User.findByIdAndUpdate(
        req.usser?._id,
        {
            $set:{
                coverImage :coverImage.url
            }
        },
        {new:true}
    ).select ("-password")

    return res
    .status(200)
    .json( new ApiResponse(200, user, "Cover Image updated Succeessfully"))
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage
};