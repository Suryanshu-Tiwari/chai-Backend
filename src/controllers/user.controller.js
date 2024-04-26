import { User } from "../models/user.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js"
import uploadOnCloudinary from "../utils/cloudinary.js";
import ApiResponse from "../utils/ApiResponse.js";

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
    // get data from req body 
    // get login details username or email
    // check if the username exists
    // check if password match with the database
    // provide access token to browse
    // provide refresh token to user experiance
    // send cookies

    const {email, username , password} = req.body

    if(!username || !email){
        throw new ApiError(400,"username or email is required")
    }

    const user = await User.findOne({$or: [{username},{email}]
    })

    if(!user){
        throw new ApiError(404,"User not Found");
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(404,"Invalid User Credentials");
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

    const loggedInUser= User.findById(user._id).select("-password -refreshToken")

    const options ={
        httpOnly: true,
        secure:  true,
    }

    return res.status(200)
    .cookie("accessToken",accessToken, options)
    .cookie("refreshToken",refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken,
                refreshToken
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

export {registerUser, loginUser,logoutUser};