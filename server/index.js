const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Database connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root', // Your MySQL username
  password: 'Vigneshwar94', // Your MySQL password
  database: 'job_recruitment'
});

// Test Database Connection
db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL database:', err);
    return;
  }
  console.log('Successfully connected to MySQL database');
});

// EMPLOYER ROUTES

// Get all jobs for an employer
app.get('/api/employer/jobs/:adminId', (req, res) => {
  const query = 'SELECT * FROM Job_Posting WHERE admin_id = ? AND is_active = TRUE';
  db.query(query, [req.params.adminId], (err, results) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(results);
  });
});

// Create a new job posting
app.post('/api/employer/jobs', (req, res) => {
  const { admin_id, title, description, location, salary_min, salary_max, skills_required } = req.body;
  const query = `
    INSERT INTO Job_Posting 
    (admin_id, title, description, location, salary_min, salary_max, posted_date, skills_required, is_active)
    VALUES (?, ?, ?, ?, ?, ?, CURDATE(), ?, TRUE)
  `;
  db.query(
    query,
    [admin_id, title, description, location, salary_min, salary_max, skills_required],
    (err, result) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: result.insertId, message: 'Job posted successfully' });
    }
  );
});

// Update a job posting
app.put('/api/employer/jobs/:jobId', (req, res) => {
  const { title, description, location, salary_min, salary_max, skills_required } = req.body;
  const query = `
    UPDATE Job_Posting 
    SET title = ?, description = ?, location = ?, 
        salary_min = ?, salary_max = ?, skills_required = ?
    WHERE job_id = ?
  `;
  db.query(
    query,
    [title, description, location, salary_min, salary_max, skills_required, req.params.jobId],
    (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Job updated successfully' });
    }
  );
});

// Delete a job posting
app.delete('/api/employer/jobs/:jobId', (req, res) => {
  const query = 'UPDATE Job_Posting SET is_active = FALSE WHERE job_id = ?';
  db.query(query, [req.params.jobId], (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Job deleted successfully' });
  });
});

// Get all applications for an employer
app.get('/api/employer/applications/:adminId', (req, res) => {
  const query = `
    SELECT a.*, j.title as job_title, ap.full_name, ap.email
    FROM Application a
    JOIN Job_Posting j ON a.job_id = j.job_id
    JOIN Applicant ap ON a.applicant_id = ap.applicant_id
    WHERE j.admin_id = ?
  `;
  db.query(query, [req.params.adminId], (err, results) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(results);
  });
});

// Update application status
app.put('/api/employer/applications/:applicationId', (req, res) => {
  const query = 'UPDATE Application SET status = ? WHERE application_id = ?';
  db.query(query, [req.body.status, req.params.applicationId], (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Application status updated successfully' });
  });
});

// APPLICANT ROUTES

// Search jobs
app.get('/api/jobs/search', (req, res) => {
  const { keyword, location, industry } = req.query;
  const query = `
    SELECT j.*, a.company_name, a.industry
    FROM Job_Posting j
    JOIN Admin a ON j.admin_id = a.admin_id
    WHERE j.is_active = TRUE
    AND (
      j.title LIKE ? OR
      j.description LIKE ? OR
      j.location LIKE ? OR
      a.industry LIKE ?
    )
  `;
  const searchTerm = `%${keyword || ''}%`;
  db.query(
    query,
    [searchTerm, searchTerm, searchTerm, searchTerm],
    (err, results) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(results);
    }
  );
});

// Submit application
app.post('/api/applications', (req, res) => {
  const { job_id, applicant_id, cover_letter } = req.body;
  const query = `
    INSERT INTO Application 
    (job_id, applicant_id, application_date, status, cover_letter)
    VALUES (?, ?, CURDATE(), 'Submitted', ?)
  `;
  db.query(
    query,
    [job_id, applicant_id, cover_letter],
    (err, result) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: result.insertId, message: 'Application submitted successfully' });
    }
  );
});

// Get applicant's applications
app.get('/api/applicant/applications/:applicantId', (req, res) => {
  const query = `
    SELECT a.*, j.title as job_title, ad.company_name
    FROM Application a
    JOIN Job_Posting j ON a.job_id = j.job_id
    JOIN Admin ad ON j.admin_id = ad.admin_id
    WHERE a.applicant_id = ?
    ORDER BY a.application_date DESC
  `;
  db.query(query, [req.params.applicantId], (err, results) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(results);
  });
});

// Get applicant profile
app.get('/api/applicant/profile/:applicantId', (req, res) => {
  const query = 'SELECT * FROM Applicant WHERE applicant_id = ?';
  db.query(query, [req.params.applicantId], (err, results) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(results[0] || {});
  });
});

app.get('/api/employer/candidates/:adminId', (req, res) => {
  const query = `
    SELECT DISTINCT 
      a.applicant_id,
      a.full_name,
      a.email,
      a.experience,
      a.contact_number,
      COUNT(app.application_id) as total_applications,
      GROUP_CONCAT(DISTINCT s.skill_name) as skills
    FROM Applicant a
    LEFT JOIN Application app ON a.applicant_id = app.applicant_id
    LEFT JOIN Job_Posting j ON app.job_id = j.job_id
    LEFT JOIN Applicant_Skills aps ON a.applicant_id = aps.applicant_id
    LEFT JOIN Skills s ON aps.skill_id = s.skill_id
    WHERE j.admin_id = ?
    GROUP BY a.applicant_id
  `;
  
  db.query(query, [req.params.adminId], (err, results) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Process the results to format skills as an array
    const candidates = results.map(candidate => ({
      ...candidate,
      skills: candidate.skills ? candidate.skills.split(',') : []
    }));
    
    res.json(candidates);
  });
});

// Update applicant profile
app.put('/api/applicant/profile/:applicantId', (req, res) => {
  const { full_name, email, experience, contact_number } = req.body;
  const query = `
    UPDATE Applicant 
    SET full_name = ?, email = ?, experience = ?, contact_number = ?
    WHERE applicant_id = ?
  `;
  db.query(
    query,
    [full_name, email, experience, contact_number, req.params.applicantId],
    (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Profile updated successfully' });
    }
  );
});

app.get('/api/test', (req, res) => {
  console.log('Test route hit');
  res.json({ message: 'Backend is working' });
});

// Get all applicants route with detailed logging
app.get('/api/applicants', (req, res) => {
  console.log('Fetching applicants...');
  
  const query = `
    SELECT 
      a.applicant_id,
      a.full_name,
      a.email,
      a.contact_number,
      a.experience,
      GROUP_CONCAT(s.skill_name) as skills
    FROM Applicant a
    LEFT JOIN Applicant_Skills aps ON a.applicant_id = aps.applicant_id
    LEFT JOIN Skills s ON aps.skill_id = s.skill_id
    GROUP BY a.applicant_id
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Database query error:', err);
      return res.status(500).json({ error: 'Database error', details: err.message });
    }

    console.log('Query results:', results);
    res.json(results);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});


// Update applicant profile
app.put('/api/applicant/profile/:applicantId', (req, res) => {
  const { applicantId } = req.params;
  const { full_name, email, contact_number, experience } = req.body;
  
  const query = `
    UPDATE Applicant 
    SET full_name = ?, email = ?, contact_number = ?, experience = ?
    WHERE applicant_id = ?
  `;
  
  db.query(
    query, 
    [full_name, email, contact_number, experience, applicantId],
    (err, result) => {
      if (err) {
        console.error('Error updating profile:', err);
        return res.status(500).json({ error: 'Error updating profile' });
      }
      res.json({ message: 'Profile updated successfully' });
    }
  );
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});