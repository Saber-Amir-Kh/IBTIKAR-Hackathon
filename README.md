# Sentinelle Algérie — Community Wildfire Early-Detection & Mobilization Platform

Plateforme intégrée d'alerte précoce aux feux de forêt, gestion de crise communautaire (*Tajmaât*) et planification du reboisement post-incendie en Algérie.

---

## 🏗️ Architecture du Projet

Le dépôt est composé de trois briques autonomes :

```
/Spring-project/IBTIKAR-Hackathon  — Backend Principal Spring Boot 3.4 (Port 8080)
/React-project                     — Interface Opérationnelle React + Vite + Leaflet (Port 5173)
/Python                            — Microservice IA Détection Feu & Fumée FastAPI (Port 8000)
```

- **Backend Spring Boot (Port 8080)** : Cœur décisionnel unique, simulation télémétrique des drones patrouilleurs (Tikjda, Djebel Chenoua, Béni Yenni), base de données MySQL (`wildfire_db`), hub WebSocket temps-réel (`/ws`), cycle de vie des incidents, diffusion des alertes bilingues Tajmaât (FR/AR), bourse d'entraide logistique et générateur de parcelles de reboisement.
- **Frontend React (Port 5173)** : Dashboard de supervision d'urgence avec carte Leaflet de l'Algérie du Nord, sélecteur de rôles sans mot de passe, vidéo en direct, journal d'audit des événements et planificateur de reboisement avec coloration dynamique des parcelles (terre brûlée vers vert forêt).
- **Microservice IA Python (Port 8000)** : Capteur sans état capturant le flux vidéo (`STREAM_URL`), détection YOLOv8n / heuristique couleur+mouvement, filtre de déclenchement soutenu (5 images consécutives >= 75%) avec refroidissement anti-spam (60s), serveur de snapshots et proxy MJPEG.

---

## 🚀 Démarrage Rapide

### 1. Démarrer le Backend Spring Boot (Terminal 1)
Prérequis : MySQL en cours d'exécution sur le port 3306 (`root` / `1234`). La base `wildfire_db` sera créée automatiquement au premier lancement.

```powershell
cd "Spring-project\IBTIKAR-Hackathon"
.\mvnw.cmd spring-boot:run
```
*Le serveur écoute sur http://localhost:8080 et initialise automatiquement 4 utilisateurs et 1 incident historique contenu avec reboisement à 40%.*

### 2. Démarrer le Frontend React (Terminal 2)

```powershell
cd "React-project"
npm run dev
```
*Accessible sur **http://localhost:5173**.*

### 3. Démarrer le Microservice IA Python (Terminal 3)

```powershell
cd "Python"
.\run.ps1
# Ou manuellement :
# .\venv\Scripts\activate
# python main.py
```
*Accessible sur http://localhost:8000 (Documentation Swagger sur http://localhost:8000/docs).*

> **Astuce caméra** : Pour pointer le microservice sur votre webcam locale plutôt que le Raspberry Pi, modifiez `STREAM_URL=0` dans `Python/.env`. Si aucune caméra n'est connectée, le service génère automatiquement un flux de surveillance synthétique réaliste pour que la démo ne plante jamais.

---

## 🧪 Scénario de Démonstration & Test d'Acceptation

### Test 1 : Fonctionnement Autonome Hors-Ligne (Sans Python)
1. Lancez Spring Boot et le Frontend React. Le microservice Python reste éteint.
2. Dans le frontend, cliquez sur **⚡ Simuler Détection** (ou exécutez `POST http://localhost:8080/api/demo/trigger-detection`).
3. **Résultat** : En moins de 2 secondes, un nouvel incident apparaît sur la carte avec un marqueur rouge clignotant via WebSocket, géolocalisé au niveau du drone patrouilleur le plus proche.

### Test 2 : Cycle de Vie & Mobilisation Tajmaât
1. **Validation Terrain** :
   - Basculez le rôle utilisateur sur **Amine Ait-Ahmed (Chef Comité Tajmaât)**.
   - Cliquez sur le marqueur de feu et cliquez sur **"Confirmer l'incendie"**.
   - Cliquez sur **"Copier l'alerte Tajmaât"** : le message d'urgence bilingue FR/AR s'affiche avec consignes de sécurité exclusives (défrichage, pare-feu, priorité aux personnes âgées, interdiction d'attaquer directement le feu).
2. **Entraide Communautaire** :
   - Basculez en **Karim Haddad (Coordinateur de Crise)** dans l'onglet *Entraide Communautaire*.
   - Publiez 3 besoins (ex: 100 bouteilles d'eau, 20 pelles, 50 masques).
   - Ouvrez une seconde fenêtre navigateur, basculez en **Yasmine Mansouri (Bénévole)** et réclamez 20 bouteilles d'eau. La barre de progression se met à jour instantanément sans rechargement.
   - Tentez de réclamer une quantité supérieure au reste disponible : le blocage côté client et serveur empêche tout dépassement.
3. **Maîtrise & Reboisement** :
   - Cliquez sur **"Marquer l'incendie maîtrisé (Contenu)"** : 5 parcelles de reboisement sont créées automatiquement autour du feu.
   - Basculez en **Tarek Benali (Club Éco)** dans l'onglet *Reboisement*.
   - Cliquez sur une parcelle et enregistrez des plantations (`+10`, `+25`, `+50`). La couleur de la parcelle passe dynamiquement de la terre brûlée brune au vert forêt.

### Test 3 : Détection Réelle par le Microservice Python
1. Démarrez le service Python avec `STREAM_URL=0` (webcam).
2. Allumez un briquet ou passez une vidéo de feu devant la caméra.
3. Le capteur exige 5 images consécutives au-dessus de 75% de confiance avant de déclencher l'alerte webhook.
4. **Résultat** : Un seul incident est créé avec snapshot réel capturé dans `./snapshots`. Aucun spam n'est envoyé grâce au refroidissement de 60 secondes.

### Test 4 : Résilience en Cas de Panne du Capteur
1. Coupez le microservice Python (`Ctrl+C`).
2. **Résultat** : L'interface React et le backend Spring Boot continuent de fonctionner parfaitement sans ralentissement ni blocage.

### Test 5 : Réinitialisation
1. Cliquez sur **🔄 Réinitialiser** dans la barre supérieure du frontend.
2. La base de données est remise à zéro et réensemencée dans son état de référence.
