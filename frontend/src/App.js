import { useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from "react-router-dom";
import axios from "axios";
import { Toaster, toast } from "sonner";
import { GraduationCap, Shield, User, LogOut, Upload, FileSpreadsheet, Search, BookOpen, Award, Download } from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context Helper
const getToken = () => localStorage.getItem("adminToken");
const setToken = (token) => localStorage.setItem("adminToken", token);
const clearToken = () => localStorage.removeItem("adminToken");

// Header Component
const Header = ({ showLogout = false }) => {
  const navigate = useNavigate();
  
  const handleLogout = () => {
    clearToken();
    toast.success("Logged out successfully");
    navigate("/");
  };

  return (
    <header className="bg-gradient-to-r from-blue-700 to-blue-600 text-white shadow-lg">
      <div className="max-w-6xl mx-auto px-4 py-5 flex items-center justify-between">
        <div 
          className="flex items-center gap-3 cursor-pointer" 
          onClick={() => navigate("/")}
          data-testid="header-logo"
        >
          <GraduationCap className="w-8 h-8" />
          <h1 className="text-xl md:text-2xl font-bold tracking-wide">College Result Portal</h1>
        </div>
        {showLogout && (
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-all"
            data-testid="logout-btn"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        )}
      </div>
    </header>
  );
};

// Footer Component
const Footer = () => (
  <footer className="bg-gray-100 border-t mt-auto py-4">
    <p className="text-center text-gray-500 text-sm">
      © 2025 St Peters College of Engineering and Technology - Examination Branch
      <br />
      All Rights Reserved
    </p>
  </footer>
);

// Landing Page
const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 max-w-lg w-full text-center" data-testid="landing-container">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <BookOpen className="w-10 h-10 text-blue-600" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-3">Welcome</h2>
          <p className="text-gray-500 mb-8">Access examination results and administrative functions</p>
          
          <div className="space-y-4">
            <button
              onClick={() => navigate("/login")}
              className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white py-4 px-6 rounded-xl font-semibold transition-all transform hover:scale-[1.02] shadow-md"
              data-testid="admin-panel-btn"
            >
              <Shield className="w-5 h-5" />
              Admin Panel
            </button>
            <button
              onClick={() => navigate("/student")}
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-50 py-4 px-6 rounded-xl font-semibold transition-all transform hover:scale-[1.02]"
              data-testid="student-result-btn"
            >
              <User className="w-5 h-5" />
              Student Result
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

// Login Page
const LoginPage = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showOtp, setShowOtp] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await axios.post(`${API}/login`, { username, password });
      
      if (res.data.otp_required === false) {
        // OTP skipped (Twilio not configured)
        setToken(res.data.token);
        toast.success("Login successful!");
        navigate("/admin");
      } else {
        // OTP sent
        setSessionId(res.data.session_id);
        setShowOtp(true);
        toast.success("OTP sent to registered phone number");
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setLoading(true);
    
    try {
      const res = await axios.post(`${API}/verify-otp?session_id=${sessionId}`, { code: otp });
      setToken(res.data.token);
      toast.success("OTP verified successfully!");
      navigate("/admin");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10 max-w-md w-full" data-testid="login-container">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Admin Portal Login</h2>
            <p className="text-gray-500 mt-2">Enter your credentials to continue</p>
          </div>

          {!showOtp ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="Enter username"
                  required
                  data-testid="username-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="Enter password"
                  required
                  data-testid="password-input"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="login-btn"
              >
                {loading ? "Please wait..." : "Login"}
              </button>
            </form>
          ) : (
            <div className="space-y-5" data-testid="otp-section">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <p className="text-blue-700 font-medium">OTP sent to your registered phone</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Enter OTP</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-center text-xl tracking-widest"
                  placeholder="• • • • • •"
                  maxLength={6}
                  data-testid="otp-input"
                />
              </div>
              <button
                onClick={handleVerifyOtp}
                disabled={loading || otp.length < 4}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="verify-otp-btn"
              >
                {loading ? "Verifying..." : "Verify OTP"}
              </button>
            </div>
          )}
          
          <button
            onClick={() => navigate("/")}
            className="w-full mt-4 text-gray-500 hover:text-gray-700 py-2 text-sm"
            data-testid="back-home-btn"
          >
            ← Back to Home
          </button>
        </div>
      </main>
      <Footer />
    </div>
  );
};

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const token = getToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Admin Dashboard
const AdminDashboard = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    rollNo: "",
    name: "",
    dob: "",
    course: ""
  });
  const [subjects, setSubjects] = useState([{ code: "", semester: "", grade: "" }]);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  const courses = [
    "B.E. Computer Science Engineering",
    "B.Tech Information Technology",
    "B.E. Mechanical Engineering",
    "B.Tech Artificial Intelligence and Data Science",
    "B.E. Civil Engineering",
    "B.Tech Electronics and Communication Engineering",
    "B.E. Electrical and Electronics Engineering",
    "B.Tech Chemical Engineering",
    "B.E. Electronics Engineering",
    "B.Tech Biotechnology"
  ];

  const addSubject = () => {
    setSubjects([...subjects, { code: "", semester: "", grade: "" }]);
  };

  const updateSubject = (index, field, value) => {
    const updated = [...subjects];
    updated[index][field] = value;
    setSubjects(updated);
  };

  const removeSubject = (index) => {
    if (subjects.length > 1) {
      setSubjects(subjects.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = getToken();
      const res = await axios.post(
        `${API}/admin/save?token=${token}`,
        { ...formData, subjects }
      );
      toast.success(res.data.message);
      // Reset form
      setFormData({ rollNo: "", name: "", dob: "", course: "" });
      setSubjects([{ code: "", semester: "", grade: "" }]);
    } catch (err) {
      if (err.response?.status === 401) {
        clearToken();
        navigate("/login");
        toast.error("Session expired. Please login again.");
      } else {
        toast.error(err.response?.data?.detail || "Error saving data");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error("Please select a file");
      return;
    }

    setUploadLoading(true);
    const formDataFile = new FormData();
    formDataFile.append("file", file);

    try {
      const token = getToken();
      const res = await axios.post(
        `${API}/admin/upload?token=${token}`,
        formDataFile,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      toast.success(res.data.message);
      setFile(null);
      // Reset file input
      document.getElementById("excel-upload").value = "";
    } catch (err) {
      if (err.response?.status === 401) {
        clearToken();
        navigate("/login");
        toast.error("Session expired. Please login again.");
      } else {
        toast.error(err.response?.data?.detail || "Error uploading file");
      }
    } finally {
      setUploadLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header showLogout={true} />
      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800">Admin Dashboard</h2>
            <p className="text-gray-500 mt-2">Manage student examination results</p>
          </div>

          {/* Manual Entry Form */}
          <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 mb-8" data-testid="manual-entry-form">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Manual Result Entry</h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Roll Number</label>
                  <input
                    type="text"
                    value={formData.rollNo}
                    onChange={(e) => setFormData({ ...formData, rollNo: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="Enter roll number"
                    required
                    data-testid="roll-no-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Student Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="Enter student name"
                    required
                    data-testid="student-name-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
                  <input
                    type="date"
                    value={formData.dob}
                    onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    required
                    data-testid="dob-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Course</label>
                  <select
                    value={formData.course}
                    onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                    required
                    data-testid="course-select"
                  >
                    <option value="">Select Course</option>
                    {courses.map((course) => (
                      <option key={course} value={course}>{course}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Subjects Section */}
              <div className="border-t pt-5 mt-5">
                <h4 className="font-semibold text-gray-800 mb-4">Subjects</h4>
                {subjects.map((subject, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3 p-4 bg-gray-50 rounded-lg">
                    <input
                      type="text"
                      value={subject.code}
                      onChange={(e) => updateSubject(index, "code", e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Subject Code"
                      required
                      data-testid={`subject-code-${index}`}
                    />
                    <input
                      type="text"
                      value={subject.semester}
                      onChange={(e) => updateSubject(index, "semester", e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Semester"
                      required
                      data-testid={`subject-semester-${index}`}
                    />
                    <input
                      type="text"
                      value={subject.grade}
                      onChange={(e) => updateSubject(index, "grade", e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Grade (O, A+, A, B+, B, C, F)"
                      required
                      data-testid={`subject-grade-${index}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeSubject(index)}
                      className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                      disabled={subjects.length === 1}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addSubject}
                  className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                  data-testid="add-subject-btn"
                >
                  + Add Another Subject
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition-all disabled:opacity-50"
                data-testid="save-result-btn"
              >
                {loading ? "Saving..." : "Save Result"}
              </button>
            </form>
          </div>

          {/* Excel Upload Form */}
          <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8" data-testid="excel-upload-form">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Upload className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Upload Results via Excel</h3>
            </div>

            <form onSubmit={handleFileUpload} className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-all">
                <input
                  type="file"
                  id="excel-upload"
                  accept=".xls,.xlsx"
                  onChange={(e) => setFile(e.target.files[0])}
                  className="hidden"
                  data-testid="excel-file-input"
                />
                <label htmlFor="excel-upload" className="cursor-pointer">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">
                    {file ? file.name : "Click to upload Excel file"}
                  </p>
                  <p className="text-gray-400 text-sm mt-1">.xls or .xlsx files only</p>
                </label>
              </div>
              <button
                type="submit"
                disabled={uploadLoading || !file}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition-all disabled:opacity-50"
                data-testid="upload-excel-btn"
              >
                {uploadLoading ? "Uploading..." : "Upload Excel"}
              </button>
            </form>

            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 font-medium mb-2">Excel Format Guide:</p>
              <p className="text-xs text-gray-500">
                Columns: rollNo, name, dob, course, subjectCode1, subjectSemester1, subjectGrade1, ... (up to 25 subjects)
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

// Student Result Page
const StudentResultPage = () => {
  const navigate = useNavigate();
  const [rollNo, setRollNo] = useState("");
  const [dob, setDob] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await axios.get(`${API}/student/result?rollNo=${rollNo}&dob=${dob}`);
      
      if (res.data.message) {
        setError(res.data.message);
      } else {
        setResult(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Error fetching result");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          {/* Search Form */}
          <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 mb-8" data-testid="student-search-form">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Check Your Result</h2>
              <p className="text-gray-500 mt-2">Enter your roll number and date of birth</p>
            </div>

            <form onSubmit={handleSearch} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Roll Number</label>
                <input
                  type="text"
                  value={rollNo}
                  onChange={(e) => setRollNo(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Enter your roll number"
                  required
                  data-testid="student-roll-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  required
                  data-testid="student-dob-input"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition-all disabled:opacity-50"
                data-testid="view-result-btn"
              >
                {loading ? "Searching..." : "View Result"}
              </button>
            </form>

            <button
              onClick={() => navigate("/")}
              className="w-full mt-4 text-gray-500 hover:text-gray-700 py-2 text-sm"
            >
              ← Back to Home
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center mb-8" data-testid="error-message">
              <p className="text-red-600 font-medium">{error}</p>
            </div>
          )}

          {/* Result Display */}
          {result && (
            <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8" data-testid="result-display">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Award className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-800">Examination Result</h3>
              </div>

              {/* Student Info */}
              <div className="bg-gray-50 rounded-xl p-5 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Name</p>
                    <p className="font-semibold text-gray-800" data-testid="result-name">{result.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Roll Number</p>
                    <p className="font-semibold text-gray-800" data-testid="result-rollno">{result.rollNo}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-sm text-gray-500">Course</p>
                    <p className="font-semibold text-gray-800" data-testid="result-course">{result.course}</p>
                  </div>
                </div>
              </div>

              {/* Results Table */}
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="results-table">
                  <thead>
                    <tr className="bg-blue-600 text-white">
                      <th className="px-4 py-3 text-left rounded-tl-lg">Semester</th>
                      <th className="px-4 py-3 text-left">Subject Code</th>
                      <th className="px-4 py-3 text-center">Grade</th>
                      <th className="px-4 py-3 text-center rounded-tr-lg">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.results.map((subject, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-800">{subject.semester}</td>
                        <td className="px-4 py-3 text-gray-800">{subject.code}</td>
                        <td className="px-4 py-3 text-center font-semibold text-gray-800">{subject.grade}</td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                              subject.status === "Pass"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                            data-testid={`status-${index}`}
                          >
                            {subject.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

function App() {
  return (
    <div className="App">
      <Toaster position="top-center" richColors />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/student" element={<StudentResultPage />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
