import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin (Using application default credentials or explicit config in production)
// Note: In AI Studio, we mock the admin functionality if credentials aren't provided.
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        initializeApp({
            credential: cert(serviceAccount)
        });
    } catch (e) {
        console.error("Failed to initialize Firebase Admin:", e);
    }
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.set('trust proxy', true); // Trust the reverse proxy to get correct IP
  app.use(express.json());

  // API Route: VPN/Proxy Check
  app.post("/api/check-vpn", async (req, res) => {
    try {
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      // In a real scenario, you'd call a VPN detection API here:
      // const response = await fetch(`https://vpnapi.io/api/${clientIp}?key=${process.env.VPNAPI_KEY}`);
      // const data = await response.json();
      // const isVpn = data.security.vpn || data.security.proxy;
      
      // For demonstration, we'll mock it (allow all)
      const isVpn = false; 
      
      if (isVpn) {
        return res.status(403).json({ success: false, message: "VPN Detected, Please Turn It Off" });
      }
      
      res.json({ success: true, message: "Clean IP" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // API Route: Secure Postback from Offerwall
  app.get("/api/postback", async (req, res) => {
    // Example query: ?uid=123&offer_name=AppInstall&points=50&hash=xyz
    const { uid, offer_name, points, hash } = req.query;
    
    // In production, verify the hash/signature provided by the offerwall network!
    // Example: const expectedHash = crypto.createHash('md5').update(`${uid}${offer_name}${points}${SECRET}`).digest("hex");
    // if (hash !== expectedHash) return res.status(400).send("Invalid Hash");

    if (!uid || !points) {
      return res.status(400).send("Missing parameters");
    }

    if (getApps().length > 0) {
        try {
            // Ensure we use the correct database ID configured in the applet
            const firebaseConfig = require('./firebase-applet-config.json');
            const db = getFirestore(getApps()[0], firebaseConfig.firestoreDatabaseId);
            const pointsToAdd = parseInt(points as string, 10);
            
            // Log conversion
            const conversionRef = db.collection('conversions').doc();
            await conversionRef.set({
                conversionId: conversionRef.id,
                uid: uid,
                offerName: offer_name || 'Unknown',
                pointsEarned: pointsToAdd,
                timestamp: FieldValue.serverTimestamp()
            });

            // Update user balance
            const userRef = db.collection('users').doc(uid as string);
            await userRef.set({
                points: FieldValue.increment(pointsToAdd)
            }, { merge: true });

            return res.status(200).send("OK");
        } catch (err) {
            console.error("Postback error:", err);
            return res.status(500).send("Internal Server Error");
        }
    } else {
        // Mock postback if Firebase isn't set up yet
        console.log(`[Mock Postback] User: ${uid}, Points: ${points}, Offer: ${offer_name}`);
        return res.status(200).send("OK (Mocked)");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
