CREATE TABLE files (
    id INTEGER PRIMARY KEY,
    pdf TEXT NOT NULL,
    preview TEXT NOT NULL,
    course TEXT NOT NULL,
    session TEXT,
    type TEXT CHECK (type IN ('midterm', 'final', 'quiz')),
    number INTEGER,
    practice BOOLEAN NOT NULL DEFAULT FALSE,
    solutions BOOLEAN NOT NULL DEFAULT FALSE,
    approved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX files_course ON files(course, approved);
