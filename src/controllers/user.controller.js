import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import { User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";

const generateAccessAndRefreshToken = async(userId) => {
    try {
        const user = await User.findById(userId) //find user by id
        const accessToken = await user.generateAccessToken() //generate acces token
        const refreshToken = await user.generateRefreshToken() //generate refreshtoken
        user.refreshToken = refreshToken //update refreshtoken in dB
        user.save( {validateBeforeSave: false} ) //do not validate before saving in dB
 
    return { accessToken, refreshToken } //return both 
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating access and refresh token")
    }
}

const registerUser = asyncHandler( async (req, res) => {
    // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res

    // get user details from frontend
    const {fullName, email, username, password } = req.body
    console.log("Request body : " ,req.body);

    // validation - not empty
    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new ApiError(400, "Invalid email format");
    }

    // Password validation - at least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/;
    if (!passwordRegex.test(password)) {
        throw new ApiError(400, "Password must be at least 6 characters long, contain an uppercase letter, a lowercase letter, a number, and a special character");
    }

    // check if user already exists: username, email
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }
    console.log("Request files : " ,req.files);

    // check for images, check for avatar
    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    console.log("avatarLocalPath : " ,avatarLocalPath);
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;    

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    // upload them to cloudinary, avatar
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    console.log("avatar : ", avatar);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }

    // create user object - create entry in db
    console.log("User:", User);
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email, 
        password,
        username: username.toLowerCase()
    })

    // remove password and refresh token field from response
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    console.log("createdUser: ", createdUser); // this is the postman response

    // check for user creation
    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    // return res
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )
})

const loginUser = asyncHandler( async (req, res) => {
    // get data from user
    // check user if registered using username or email
    // find the user
    // password check
    // access and refresh token
    // send cookie

    // get data from user
    console.log("requestBody:", req.body);
    const {username, email, password} = req.body;
    console.log("username", username);
    console.log("email", email);

    if(!username && !email){
        throw new ApiError(400, "username or email is required");
    }
    // check user if registered using username or email
    const user = await User.findOne({
        $or: [{ username }, { email }]
    })
    if(!user){
        throw new ApiError(404, "User doesn't exist");
    }
    // find the user
    console.log(user);

    // password check
    const isPasswordValid = await user.isPasswordCorrect(password);

    if(!isPasswordValid){
        throw new ApiError(401, "Invalid user credentials");
    }

    // access and refresh token
    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id); 
    console.log(accessToken, refreshToken);

    // send cookie
    const loggedInUser = await User.findById(user._id); // make this new logged in user even though we already made it in generateAccessAndRefreshToken function but we dont have access to it in this scope we have access to this above user variable which does not contain refresh token added which we saved so take this new updated user from dB

    const options = {
        httpOnly: true,
        secure: true,
    }

    res
    .status(200)
    .cookie("accessToken", accessToken)
    .cookie("refreshToken", refreshToken)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged In successfully"
        )
    )


})

const logoutUser = asyncHandler(async(req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: 1 // this removes the field from document
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"))
})

const refreshAccessToken = asyncHandler( async(req, res) => {

    // take refresh Token from the user whose session has expired
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    // if refresh token is not present from user side send error
    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorized request")
    }

    try {
        // verify the refresh token if it's correct or not
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        // find user now from the refresh token
        const user = User.findById(decodedToken?._id);
        console.log(user);
        if(!user){
            throw new ApiError(401, "Invalid refresh token")
        }
    
        // and check if the refresh token coming from user and the refresh token for the same user stored in db is same or not
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "Refresh token is expired or used")
        }
    
        // if it matches generate new access token
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newrefreshToken} = await generateAccessAndRefreshToken(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newrefreshToken, options)
        .json(
            new ApiResponse(
                200, 
                {accessToken, refreshToken: newrefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }



})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken
}