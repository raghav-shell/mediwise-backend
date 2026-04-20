import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Groq from 'groq-sdk';
import Tesseract from 'tesseract.js';
import db from './db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_dev_key_123';

// Initialize Groq
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'MISSING_KEY' });

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for image uploads

// --- Authentication Middleware ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access denied' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// --- Authentication Routes ---

app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'All fields are required' });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const insert = db.prepare('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)');
    const info = insert.run(email, hashedPassword, name);
    
    const token = jwt.sign({ id: info.lastInsertRowid, email }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: info.lastInsertRowid, name, email } });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(400).json({ error: 'User not found' });

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(400).json({ error: 'Invalid password' });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// --- User Cabinet Routes ---

app.get('/api/cabinet', authenticateToken, (req, res) => {
  try {
    const meds = db.prepare('SELECT * FROM cabinet WHERE user_id = ? ORDER BY added_at DESC').all(req.user.id);
    res.json(meds);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cabinet' });
  }
});

app.post('/api/cabinet', authenticateToken, (req, res) => {
  const { medicine_name, dosage, notes } = req.body;
  if (!medicine_name) return res.status(400).json({ error: 'Medicine name is required' });

  try {
    const existing = db.prepare('SELECT id FROM cabinet WHERE user_id = ? AND LOWER(medicine_name) = ?').get(req.user.id, medicine_name.toLowerCase());
    if (existing) {
      return res.status(400).json({ error: 'Medicine already in cabinet' });
    }

    const insert = db.prepare('INSERT INTO cabinet (user_id, medicine_name, dosage, notes) VALUES (?, ?, ?, ?)');
    const info = insert.run(req.user.id, medicine_name, dosage || '', notes || '');
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add medicine' });
  }
});

app.delete('/api/cabinet/:id', authenticateToken, (req, res) => {
  try {
    db.prepare('DELETE FROM cabinet WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete medicine' });
  }
});

// --- Existing Public API Routes ---

// 1. Medicine Search API (Live Groq AI Medical Dictionary)
app.get('/api/search', async (req, res) => {
  const query = req.query.q?.toLowerCase() || '';
  
  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  console.log(`[API] Fetching medical data via Groq AI for: ${query}`);

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are an expert, highly accurate medical dictionary. A user is asking for information about the medication: "${query}".
          IMPORTANT INSTRUCTIONS:
          1. Recognize international and Indian brands (e.g., DermaDew, Tranesma, Dolo).
          2. If the drug is used 'off-label' (e.g. Tranesma / Tranexamic Acid is officially for heavy bleeding but commonly used off-label by dermatologists for skin pigmentation), mention BOTH uses.
          3. If it is a topical cream, do NOT list oral side effects like nausea/vomiting unless absorbed systemically. List skin side effects.
          
          Return a strict JSON object with exactly these keys: 
          "name" (properly capitalized brand name + generic name in brackets), 
          "type" (e.g., Topical Cream, Oral Tablet, Antibiotic), 
          "uses" (A concise 1-2 sentence description including primary and common off-label uses), 
          "sideEffects" (an array of exactly 3 concise string side effects), 
          "warnings" (1 critical warning sentence).
          
          Only return the raw JSON object, no markdown.`
        }
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.1,
      max_tokens: 500,
    });

    let aiResponse = completion.choices[0]?.message?.content || "{}";
    if (aiResponse.includes('```json')) {
      aiResponse = aiResponse.split('```json')[1].split('```')[0].trim();
    } else if (aiResponse.includes('```')) {
      aiResponse = aiResponse.split('```')[1].trim();
    }

    const medData = JSON.parse(aiResponse);
    return res.json(medData);

  } catch (error) {
    console.error('[API] Groq search failed:', error);
    return res.status(500).json({
      name: query.charAt(0).toUpperCase() + query.slice(1),
      type: 'Medication',
      uses: 'Information not available. Please consult a doctor.',
      sideEffects: ['Please consult a healthcare professional.'],
      warnings: 'Always read the label before use.'
    });
  }
});

// 2. Interaction Checker API (Live Groq AI Integration)
app.post('/api/interactions', async (req, res) => {
  const { medicines } = req.body;
  
  if (!medicines || medicines.length < 2) {
    return res.status(400).json({ error: 'Please provide at least 2 medications to check.' });
  }

  console.log(`[API] AI Checking interactions for: ${medicines.join(', ')}`);

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are an expert clinical pharmacist AI. A user is checking for drug interactions between the following medications: [${medicines.join(', ')}].
          Identify any significant pharmacological interactions. 
          
          Return a STRICT JSON object with exactly these keys:
          "riskLevel" (String: Must be exactly "SAFE", "MODERATE", or "HIGH"),
          "interactions" (An array of objects, each containing: 
             "meds" (array of the 2 interacting drugs), 
             "severity" (String: "Safe", "Moderate Risk", or "High Risk"), 
             "description" (A concise 1-2 sentence explanation of the interaction).
          )
          
          If there are NO interactions, return riskLevel "SAFE" and one item in the array explaining they are generally safe to take together.
          Do NOT include markdown wrapping like \`\`\`json. Return pure JSON.`
        }
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.1,
    });

    let aiResponse = completion.choices[0]?.message?.content || "{}";
    if (aiResponse.includes('```json')) {
      aiResponse = aiResponse.split('```json')[1].split('```')[0].trim();
    } else if (aiResponse.includes('```')) {
      aiResponse = aiResponse.split('```')[1].trim();
    }

    const interactionData = JSON.parse(aiResponse);
    return res.json(interactionData);

  } catch (error) {
    console.error('[API] Interaction check failed:', error);
    res.status(500).json({ error: 'Failed to analyze interactions.' });
  }
});

// 3. OCR Scan API (Real Tesseract + Groq Integration)
app.post('/api/scan', async (req, res) => {
  const { image } = req.body;
  
  if (!image) {
    return res.status(400).json({ error: 'No image provided for scanning.' });
  }

  console.log('[API] Received real prescription scan. Running Tesseract OCR...');

  try {
    // 1. Run Tesseract OCR on the Base64 image
    const { data: { text } } = await Tesseract.recognize(image, 'eng');
    console.log('[API] Tesseract extracted text:', text.substring(0, 50) + '...');

    if (!text.trim()) {
      return res.status(400).json({ error: 'Could not read any text from the image.' });
    }

    // 2. Feed raw OCR text to Groq AI to extract structured data
    console.log('[API] Sending raw text to Groq for parsing...');
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are an expert medical data extractor. I will provide raw, messy OCR text from a prescription bottle or receipt.
Your ONLY job is to extract the medicine names, types (Tablet, Capsule, Liquid), and dosages.
Return the result strictly as a valid JSON array of objects. Do NOT include markdown blocks. Do NOT include any other text.
Format example: [{"name": "Amoxicillin 500mg", "type": "Capsule", "dosage": "1x per day"}]`
        },
        {
          role: "user",
          content: `Here is the raw OCR text: \n\n${text}`
        }
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.1,
    });

    let aiResponse = completion.choices[0]?.message?.content || "[]";
    
    // Clean up potential markdown wrapper from AI response
    if (aiResponse.includes('```json')) {
      aiResponse = aiResponse.split('```json')[1].split('```')[0].trim();
    } else if (aiResponse.includes('```')) {
      aiResponse = aiResponse.split('```')[1].trim();
    }

    const detectedMedicines = JSON.parse(aiResponse);

    return res.json({
      success: true,
      detectedMedicines
    });

  } catch (error) {
    console.error('[API] OCR Scan Error:', error);
    res.status(500).json({ error: 'Failed to process prescription image.' });
  }
});

// 5. AI Chatbot API (Groq Integration)
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  
  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'Groq API Key is missing.' });
  }

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are MediWise, an expert AI medical assistant. You must provide concise, professional, and empathetic medical guidance. IMPORTANT: You must always end medical advice by reminding the user to consult a doctor."
        },
        {
          role: "user",
          content: message
        }
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.5,
      max_tokens: 1024,
    });

    res.json({ reply: completion.choices[0]?.message?.content || "I am unable to process that request." });
  } catch (error) {
    console.error('[API] Groq Chat Error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate AI response.' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ MediWise Backend API running on http://localhost:${PORT}`);
});
