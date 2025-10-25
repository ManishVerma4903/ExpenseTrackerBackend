import express from "express";
import Expense from "../models/expense.js";
import User from "../models/user.js";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { authMiddleware } from "../middleware/auth.js";

dayjs.extend(isBetween);

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "manishexpensetracker";

// -----------------------------
// Utility function for totals
// -----------------------------
const calculateTotals = (records) => {
  const totalIncome = records
    .filter((r) => r.type === "Income")
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const totalExpense = records
    .filter((r) => r.type === "Expense")
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const totalBalance = totalIncome - totalExpense;
  ``;

  return { totalIncome, totalExpense, totalBalance };
};

// -----------------------------
// CREATE
// -----------------------------
router.post("/create-expense", authMiddleware, async (req, res) => {
  try {
    const { type, amount, category, date, description } = req.body;

    if (!type || !amount || !date) {
      return res
        .status(400)
        .json({ error: "Type, amount, and date are required." });
    }

    // Parse date (ISO or DD-MM-YYYY)
    if (!dayjs(date).isValid()) {
      return res.status(400).json({ error: "Invalid date format." });
    }

    const newRecord = await Expense.create({
      type,
      amount,
      category,
      date,
      description,
      userId: req.user._id,
    });

    const allRecords = await Expense.find({ userId: req.user._id });
    const totals = calculateTotals(allRecords);

    res.status(201).json({
      message: "Expense added successfully",
      newRecord,
      ...totals,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------
// READ ALL
// -----------------------------
router.get("/all-expenses", authMiddleware, async (req, res) => {
  try {
    // fetch only user's expenses
    const records = await Expense.find({ userId: req.user._id });

    const totals = calculateTotals(records);

    res.json({
      message: "All expenses fetched successfully",
      ...totals,
      data: records,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------
// READ ONE
// -----------------------------
router.get("/expense/:id", authMiddleware, async (req, res) => {
  try {
    const record = await Expense.findById(req.params.id);
    if (!record) return res.status(404).json({ error: "Record not found" });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------
// UPDATE
// -----------------------------
router.put("/expense/:id", authMiddleware, async (req, res) => {
  try {
    const updatedRecord = await Expense.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
      }
    );

    if (!updatedRecord)
      return res.status(404).json({ error: "Record not found" });

    const allRecords = await Expense.find();
    const totals = calculateTotals(allRecords);

    res.json({
      message: "Expense updated successfully",
      updatedRecord,
      ...totals,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------
// DELETE
// -----------------------------
router.delete("/expense/:id", authMiddleware, async (req, res) => {
  try {
    const deletedRecord = await Expense.findByIdAndDelete(req.params.id);
    if (!deletedRecord)
      return res.status(404).json({ error: "Record not found" });

    const allRecords = await Expense.find();
    const totals = calculateTotals(allRecords);

    res.json({
      message: "Expense deleted successfully",
      deletedRecord,
      ...totals,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------
// EXPENSES BY TIME FILTER
// -----------------------------
router.get("/expenses-by-time", authMiddleware, async (req, res) => {
  try {
    const { filter } = req.query;
    const validFilters = ["today", "month", "year"];

    if (!validFilters.includes(filter)) {
      return res.status(400).json({
        error: "Invalid filter. Use 'today', 'month', or 'year'.",
      });
    }

    const now = dayjs();
    let startDate, endDate;

    if (filter === "today") {
      startDate = now.startOf("day");
      endDate = now.endOf("day");
    } else if (filter === "month") {
      startDate = now.startOf("month");
      endDate = now.endOf("month");
    } else {
      startDate = now.startOf("year");
      endDate = now.endOf("year");
    }

    const allRecords = await Expense.find({ userId: req.user._id });

    // Filter by date range
    const filteredRecords = allRecords.filter((r) => {
      const recordDate = dayjs(r.date, "DD-MM-YYYY");
      return recordDate.isBetween(startDate, endDate, null, "[]");
    });

    const totals = calculateTotals(filteredRecords);

    res.json({
      message: `Expenses for ${filter}`,
      // filter,
      // ...totals,
      data: filteredRecords,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------
// EXPENSES BY Search querry
// -----------------------------

router.get("/search-expenses", authMiddleware, async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim() === "") {
      return res.status(400).json({ error: "Query parameter is required" });
    }

    // Case-insensitive search on category, description, or type
    const regex = new RegExp(query, "i");

    const results = await Expense.find({
      $or: [
        { category: { $regex: regex } },
        { description: { $regex: regex } },
        { type: { $regex: regex } },
      ],
    });

    res.json({
      message: `Search results for "${query}"`,
      totalResults: results.length,
      data: results,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------
// Register User
// -----------------------------
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check required fields
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, and password are required" });
    }

    // Strict email validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({ name, email, password: hashedPassword });
    res.status(201).json({ message: "User registered successfully", user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------
// Login User
// -----------------------------
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check required fields
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    // Strict email validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid password" });

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: "30d" } // token valid for 30 days
    );

    res.json({
      message: "Login successful",
      token,
      user: { _id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
