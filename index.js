require("dotenv").config();
const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const PROJECT_GID = process.env.ASANA_PROJECT_GID;

const SUBTASK_TEMPLATES = [
  { name: "Copy Due",            offsetDays: -14 },
  { name: "Client's Approval",   offsetDays: -12 },
  { name: "Klaviyo Setup",       offsetDays: -10 },
  { name: "Scheduled",           offsetDays: -7  },
];

function calculateDate(mainDueDate, offsetDays) {
  const date = new Date(mainDueDate);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().split("T")[0];
}

function getAsana() {
  return axios.create({
    baseURL: "https://app.asana.com/api/1.0",
    headers: { 
      Authorization: `Bearer ${process.env.ASANA_TOKEN.trim()}`,
      "Content-Type"
