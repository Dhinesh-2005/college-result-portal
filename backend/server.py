from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from jose import jwt, JWTError
from twilio.rest import Client
import openpyxl
import io

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Twilio configuration
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID', '')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN', '')
TWILIO_VERIFY_SID = os.environ.get('TWILIO_VERIFY_SID', '')
ADMIN_PHONE = os.environ.get('ADMIN_PHONE', '')

# Admin credentials
ADMIN_USER = os.environ.get('ADMIN_USER', 'admin')
ADMIN_PASS = os.environ.get('ADMIN_PASS', '12345')

# JWT Secret
SECRET_KEY = os.environ.get('SESSION_SECRET', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# =====================
# MODELS
# =====================

class Subject(BaseModel):
    code: str
    semester: str
    grade: str
    status: Optional[str] = None

class StudentCreate(BaseModel):
    rollNo: str
    name: str
    dob: str
    course: str
    subjects: List[Subject]

class LoginRequest(BaseModel):
    username: str
    password: str

class OTPVerifyRequest(BaseModel):
    code: str

class StudentResultQuery(BaseModel):
    rollNo: str
    dob: str

# =====================
# HELPER FUNCTIONS
# =====================

def get_result_status(grade: str) -> str:
    """Determine Pass/Fail based on grade - same logic as original project"""
    pass_grades = ["O", "A+", "A", "B+", "B", "C"]
    return "Pass" if grade.upper() in [g.upper() for g in pass_grades] else "Fail"

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

# Store pending OTP sessions (in production, use Redis)
pending_otp_sessions = {}

# =====================
# ROUTES
# =====================

@api_router.get("/")
async def root():
    return {"message": "College Result Portal API"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy"}

# Admin Login - Step 1: Verify credentials and send OTP
@api_router.post("/login")
async def admin_login(request: LoginRequest):
    if request.username == ADMIN_USER and request.password == ADMIN_PASS:
        # Check if Twilio is configured
        if not all([TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SID, ADMIN_PHONE]):
            # If Twilio not configured, skip OTP (for development)
            logger.warning("Twilio not configured - skipping OTP verification")
            token = create_access_token(
                data={"sub": request.username, "is_admin": True},
                expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
            )
            return {"message": "Login successful (OTP skipped - Twilio not configured)", "token": token, "otp_required": False}
        
        try:
            twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
            verification = twilio_client.verify.v2.services(TWILIO_VERIFY_SID).verifications.create(
                to=ADMIN_PHONE,
                channel="sms"
            )
            
            # Store session for OTP verification
            session_id = create_access_token(
                data={"sub": request.username, "pending_otp": True},
                expires_delta=timedelta(minutes=10)
            )
            pending_otp_sessions[session_id] = {"username": request.username}
            
            return {"message": "OTP sent", "session_id": session_id, "otp_required": True}
        except Exception as e:
            logger.error(f"OTP sending failed: {e}")
            raise HTTPException(status_code=500, detail="OTP sending failed")
    else:
        raise HTTPException(status_code=401, detail="Invalid Username or Password")

# Admin Login - Step 2: Verify OTP
@api_router.post("/verify-otp")
async def verify_otp(request: OTPVerifyRequest, session_id: str = None):
    # Check if Twilio is configured
    if not all([TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SID, ADMIN_PHONE]):
        raise HTTPException(status_code=400, detail="OTP verification not available")
    
    if not session_id or session_id not in pending_otp_sessions:
        raise HTTPException(status_code=400, detail="Invalid session")
    
    try:
        twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        check = twilio_client.verify.v2.services(TWILIO_VERIFY_SID).verification_checks.create(
            to=ADMIN_PHONE,
            code=request.code
        )
        
        if check.status == "approved":
            # Clean up pending session
            username = pending_otp_sessions.pop(session_id, {}).get("username", "admin")
            
            # Create admin token
            token = create_access_token(
                data={"sub": username, "is_admin": True},
                expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
            )
            return {"message": "Verified", "token": token}
        else:
            raise HTTPException(status_code=400, detail="Invalid OTP")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OTP verification failed: {e}")
        raise HTTPException(status_code=500, detail="OTP verification failed")

# Verify admin token helper
async def get_current_admin(token: str):
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    payload = verify_token(token)
    if not payload or not payload.get("is_admin"):
        raise HTTPException(status_code=401, detail="Not authorized")
    
    return payload

# Save student result manually
@api_router.post("/admin/save")
async def save_student(student: StudentCreate, token: str = None):
    await get_current_admin(token)
    
    try:
        # Add Pass/Fail status to each subject
        updated_subjects = []
        for s in student.subjects:
            updated_subjects.append({
                "code": s.code,
                "semester": s.semester,
                "grade": s.grade,
                "status": get_result_status(s.grade)
            })
        
        # Check if student exists
        existing = await db.students.find_one({"rollNo": student.rollNo})
        
        student_doc = {
            "rollNo": student.rollNo,
            "name": student.name,
            "dob": student.dob,
            "course": student.course,
            "subjects": updated_subjects
        }
        
        if existing:
            await db.students.update_one(
                {"rollNo": student.rollNo},
                {"$set": student_doc}
            )
            return {"message": "Updated Successfully"}
        else:
            await db.students.insert_one(student_doc)
            return {"message": "Saved Successfully"}
    except Exception as e:
        logger.error(f"Error saving student: {e}")
        raise HTTPException(status_code=500, detail="Error Saving Student")

# Upload Excel file and import results
@api_router.post("/admin/upload")
async def upload_excel(file: UploadFile = File(...), token: str = None):
    await get_current_admin(token)
    
    if not file.filename.endswith(('.xls', '.xlsx')):
        raise HTTPException(status_code=400, detail="Please upload an Excel file (.xls or .xlsx)")
    
    try:
        contents = await file.read()
        workbook = openpyxl.load_workbook(io.BytesIO(contents))
        
        for sheet_name in workbook.sheetnames:
            worksheet = workbook[sheet_name]
            
            # Get headers from first row
            headers = []
            for cell in worksheet[1]:
                headers.append(cell.value if cell.value else "")
            
            # Process each row
            for row_idx, row in enumerate(worksheet.iter_rows(min_row=2, values_only=True), start=2):
                if not row[0]:  # Skip empty rows
                    continue
                
                row_data = dict(zip(headers, row))
                
                # Handle DOB conversion (Excel date serial number)
                dob_value = row_data.get('dob', '')
                if isinstance(dob_value, (int, float)):
                    from datetime import datetime as dt
                    dob_value = (dt(1899, 12, 30) + timedelta(days=int(dob_value))).strftime('%Y-%m-%d')
                elif isinstance(dob_value, datetime):
                    dob_value = dob_value.strftime('%Y-%m-%d')
                else:
                    dob_value = str(dob_value) if dob_value else ''
                
                # Collect subjects (up to 25)
                subjects = []
                for i in range(1, 26):
                    code = row_data.get(f'subjectCode{i}')
                    semester = row_data.get(f'subjectSemester{i}')
                    grade = row_data.get(f'subjectGrade{i}')
                    
                    if code and semester and grade:
                        subjects.append({
                            "code": str(code),
                            "semester": str(semester),
                            "grade": str(grade),
                            "status": get_result_status(str(grade))
                        })
                
                # Upsert student
                student_doc = {
                    "rollNo": str(row_data.get('rollNo', '')),
                    "name": str(row_data.get('name', '')),
                    "dob": dob_value,
                    "course": str(row_data.get('course', '')),
                    "subjects": subjects
                }
                
                await db.students.update_one(
                    {"rollNo": student_doc["rollNo"]},
                    {"$set": student_doc},
                    upsert=True
                )
        
        return {"message": "Excel uploaded successfully"}
    except Exception as e:
        logger.error(f"Error processing Excel: {e}")
        raise HTTPException(status_code=500, detail="Error processing Excel file")

# Student result lookup
@api_router.get("/student/result")
async def get_student_result(rollNo: str, dob: str):
    if not rollNo or not dob:
        return {"message": "Roll No and DOB required"}
    
    try:
        student = await db.students.find_one(
            {"rollNo": rollNo, "dob": dob},
            {"_id": 0}
        )
        
        if not student:
            return {"message": "No result found"}
        
        # Ensure Pass/Fail status for each subject
        results = []
        for s in student.get("subjects", []):
            results.append({
                "code": s.get("code", ""),
                "semester": s.get("semester", ""),
                "grade": s.get("grade", ""),
                "status": get_result_status(s.get("grade", ""))
            })
        
        return {
            "rollNo": student.get("rollNo", ""),
            "name": student.get("name", ""),
            "course": student.get("course", ""),
            "dob": student.get("dob", ""),
            "results": results
        }
    except Exception as e:
        logger.error(f"Error fetching result: {e}")
        raise HTTPException(status_code=500, detail="Error fetching result")

# Verify token endpoint
@api_router.get("/verify-token")
async def verify_admin_token(token: str = None):
    try:
        await get_current_admin(token)
        return {"valid": True}
    except:
        return {"valid": False}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
