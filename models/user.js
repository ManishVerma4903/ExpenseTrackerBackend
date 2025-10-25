// models/user.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String, // hashed password is recommended
});

export default mongoose.model("User", userSchema);
