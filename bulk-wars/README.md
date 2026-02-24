# ⚔️ BULK WARS

Jeu communautaire multijoueur pour la communauté BulkTrade.
Chaque équipe clique pour pousser le prix — les bougies se forment en live !

---

## 🚀 DÉPLOIEMENT (15 minutes)

### Étape 1 — GitHub
```bash
git init
git add .
git commit -m "bulk wars init"
# Crée un repo sur github.com puis :
git remote add origin https://github.com/TON_USERNAME/bulk-wars.git
git push -u origin main
```

### Étape 2 — Backend sur Render (gratuit)
1. Va sur [render.com](https://render.com) → New → Web Service
2. Connecte ton repo GitHub
3. **Root Directory** : `server`
4. **Build Command** : `npm install`
5. **Start Command** : `npm start`
6. **Plan** : Free
7. Copie l'URL générée (ex: `https://bulk-wars-server.onrender.com`)

### Étape 3 — Frontend sur Vercel (gratuit)
1. Va sur [vercel.com](https://vercel.com) → New Project
2. Importe ton repo GitHub
3. **Framework** : Vite
4. **Root Directory** : `client`
5. Ajoute une variable d'environnement :
   - `VITE_SERVER_URL` = `https://bulk-wars-server.onrender.com` (URL Render)
6. Deploy !

### Étape 4 — Mettre à jour CORS
Dans Render, ajoute la variable d'env :
- `ALLOWED_ORIGINS` = `https://bulk-wars.vercel.app` (ton URL Vercel)

---

## 🔧 DEV LOCAL

```bash
# Terminal 1 - Server
cd server
npm install
npm run dev   # port 4000

# Terminal 2 - Client
cd client
npm install
npm run dev   # port 5173
```

---

## 🎮 RÈGLES
- Round de **2 minutes**
- **12 bougies** de 10 secondes
- Team Green clique → prix monte → bougie verte
- Team Red clique → prix descend → bougie rouge
- Chaque bougie vaut **1 point** pour l'équipe gagnante
- **Max 8 clics/seconde** par joueur (anti-bot côté serveur)

---

## 🔒 SÉCURITÉ
- Rate limiting : 8 clics/s max par socket
- Le serveur est la **source de vérité** pour le prix (pas le client)
- Validation des events côté serveur
- CORS restreint à ton domaine

---

## 📦 STACK
- **Frontend** : React + Vite → Vercel
- **Backend** : Node.js + Socket.io → Render
- **Transport** : WebSocket (Socket.io)
