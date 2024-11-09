import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js"

const registerUser = asyncHandler ( async (req, res) =>  {
    // STEPS - 
    // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res

    //STEP BY STEP - 
    // get user details from frontend
    const {fullName, email, password, username} = req.body;
    console.log("email:", email);
    console.log("password:", password); 
    console.log("username:", username);
    console.log("fullName:", fullName);
    console.log(req.body);

    // validation - not empty 
    if(
        [fullName, email, password, username].some((field) => field.trim() === "")
    ){
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
    const existedUser = User.findOne({
        $or: [{ email }, { username }]
    })
    console.log(existedUser);
    if(existedUser){
        throw new ApiError(409, "User with the same email or username already exists")
    }

    // check for images, check for avatar
    console.log(req.files);
    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverimage[0]?.path;
    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar is required");
    }
    
    // upload avatar and coverImage to cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(400, "Avatar is required");
    }

    // create user object - create entry in db
    const user = User.create({
        username, 
        email,
        fullName,
        avatar: avatar.url,
        coverImage: coverImage.url || "",
        password
    })
    const createdUser = await User.findById(user._id).select(
    // remove password and refresh token field from response
        "-password -refreshToken" 
    );

    // check for user creation
    if(!createdUser){
        throw new ApiError(500, "Something went wrong while registering the user");
    }

    // return res
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully");
    )

})

export { registerUser }