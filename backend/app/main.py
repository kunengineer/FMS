from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.core.database import Base, engine, SessionLocal
from app.seed import seed_db

# Import routers
from app.routers import auth, vehicles, operations, failures, repairs, dashboard, settings as settings_router, admin, reports, imports

import os

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS Middleware config
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Adjust in production to frontend domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auto migrate and seed on startup (for simplicity and convenience)
@app.on_event("startup")
def on_startup():
    # Make sure upload dir exists
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    # Run manual migration for new fields
    from sqlalchemy import text
    with engine.connect() as conn:
        try:
            # check if severity column exists in checklist_items
            res = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='checklist_items' AND column_name='severity'"))
            if not res.fetchone():
                conn.execute(text("ALTER TABLE checklist_items ADD COLUMN severity VARCHAR(20) DEFAULT 'light'"))
                conn.commit()
        except Exception as e:
            print("Migration warning (checklist_items.severity):", e)
            
        try:
            # check if safety_reason column exists in operation_logs
            res2 = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='operation_logs' AND column_name='safety_reason'"))
            if not res2.fetchone():
                conn.execute(text("ALTER TABLE operation_logs ADD COLUMN safety_reason TEXT"))
                conn.commit()
        except Exception as e:
            print("Migration warning (operation_logs.safety_reason):", e)
            
        try:
            if engine.dialect.name == "sqlite":
                cursor = conn.exec_driver_sql("PRAGMA table_info(operation_logs)")
                cols = [row[1] for row in cursor.fetchall()]
                if "work_type" not in cols:
                    conn.exec_driver_sql("ALTER TABLE operation_logs ADD COLUMN work_type VARCHAR(20) DEFAULT 'production'")
                    conn.commit()
            else:
                res3 = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='operation_logs' AND column_name='work_type'"))
                if not res3.fetchone():
                    conn.execute(text("ALTER TABLE operation_logs ADD COLUMN work_type VARCHAR(20) DEFAULT 'production'"))
                    conn.commit()
        except Exception as e:
            print("Migration warning (operation_logs.work_type):", e)

    # Seed data
    db = SessionLocal()
    try:
        seed_db(db)
    finally:
        db.close()

# Mount upload directory statically to serve pictures
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Register routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(vehicles.router, prefix=settings.API_V1_STR)
app.include_router(operations.router, prefix=settings.API_V1_STR)
app.include_router(failures.router, prefix=settings.API_V1_STR)
app.include_router(repairs.router, prefix=settings.API_V1_STR)
app.include_router(dashboard.router, prefix=settings.API_V1_STR)
app.include_router(settings_router.router, prefix=settings.API_V1_STR)
app.include_router(admin.router, prefix=settings.API_V1_STR)
app.include_router(reports.router, prefix=settings.API_V1_STR)
app.include_router(imports.router, prefix=settings.API_V1_STR)

@app.get("/")
def read_root():
    return {"message": "Welcome to Fleet Manager System API"}
