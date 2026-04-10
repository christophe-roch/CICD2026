
# Laboratoire CI/CD – GitHub + Docker Hub + k3s

> **Objectif du labo**  
Mettre en place un pipeline CI/CD complet qui :
- construit une image Docker à partir d’une application Node.js,
- pousse l’image sur Docker Hub,
- déploie automatiquement l’application dans un cluster k3s dans les namespaces `dev`, `qa` et `prod` selon la branche Git (`dev`, `qa`, `main`).

---

## 1. Contexte du labo

Dans ce labo, tu vas :

- Travailler avec un **cluster k3s** déjà préparé par ton enseignant.
- Utiliser les 3 VM dans les modèles de VM dans 420-4T4/K3S
- Avoir une autre VM PFSense qui utilise l'adresse IP réseau 192.168.21.0
- Utiliser **GitHub** pour héberger ton code et déclencher le pipeline.
- Utiliser **Docker Hub** pour stocker les images Docker.
- Utiliser **GitHub Actions** pour automatiser build + push + déploiement.

Les environnements sont mappés ainsi :

| Branche Git | Namespace k3s | Tag d’image Docker |
|------------|---------------|--------------------|
| `dev`      | `dev`         | `:dev`             |
| `qa`       | `qa`          | `:qa`              |
| `main`     | `prod`        | `:prod`            |

---

Architecture du labo

Voici une vue d’ensemble du pipeline :

```
          ┌──────────────┐
          │   Étudiant   │
          └──────┬───────┘
                 │ git push
                 ▼
        ┌────────────────────┐
        │   GitHub Actions   │
        └──────┬─────────────┘
               │ build + push
               ▼
      ┌──────────────────┐
      │   Docker Hub     │
      └──────┬───────────┘
             │ pull image
             ▼
     ┌────────────────────┐
     │     Cluster k3s    │
     │ dev / qa / prod    │
     └────────────────────┘
```

## 2. Prérequis

Avant de commencer, tu dois avoir :

- Un **compte GitHub**.
- Un **compte Docker Hub**.
- L’accès à la **VM control-plane** du cluster k3s (avec VS Code).
- Avoir lu : [Voir la documentation sur Git](Git.md)

---

## 3. Mise en place et récupéreration du projet de départ

### 3.1. Installer la fonctionnalité git, node.js et créer un répertoire pour le projet sur votre contrôle plan.
   ````
   sudo apt install git
   sudo apt install npm
   sudo apt install docker.io
   cd /home/etudiant/Documents/project
   code
   ````

### 3.2. Dans VS Code,
   - Aller vous positionner dans projet (Ctrl-K ctrl-O)
   - Faire menu view et terminal pour afficher un terminal
   - Dans le terminal positionnez-vous dans /home/etudiant/Documents/project/ 
   - cd /home/etudiant/Documents/project

### 3.3. Fork du dépôt
1. Sur ce repo Git, clique sur **Fork** (en haut à droite).
<br><br>   
<img width="805" height="112" alt="image" src="https://github.com/user-attachments/assets/c3322fe9-05ea-4113-880a-80410185589c" />
<br><br>
2. Choisis ton compte GitHub comme destination. (Owner *)
<br><br>
<img width="809" height="617" alt="image" src="https://github.com/user-attachments/assets/e064ae8a-3bd7-4ee7-866d-db3f327d8557" />
<br><br>
Tu as maintenant ton propre dépôt avec le code du labo.

### 3.4. Clôner ton fork sur la VM

Sur la VM (dans VS Code ou terminal) tu vas téléchager de ton git le projet en local sur la vm dans le répertoire project.

```bash
git clone https://github.com/<TON_USERNAME>/cicd2026.git
cd cicd2026
```

### 3.5. Créer la branche dev et qa à partir de la branche main (Prennez le temps de lire le script et copier ce script dans le terminal de votre Vs Code)
```
# ------------------------------------------------------------
# Étape 1 : Se placer sur la branche main
# ------------------------------------------------------------
git checkout main

# ------------------------------------------------------------
# Étape 2 : Mettre main à jour avec GitHub
# ------------------------------------------------------------
git pull origin main

# ------------------------------------------------------------
# Étape 3 : Créer la branche dev
# ------------------------------------------------------------
git branch dev

# ------------------------------------------------------------
# Étape 4 : Créer la branche qa
# ------------------------------------------------------------
git branch qa

# ------------------------------------------------------------
# Étape 5 : Envoyer les branches sur GitHub
# ------------------------------------------------------------
git push -u origin dev
git push -u origin qa

# ------------------------------------------------------------
# Étape 6 : Positionnement sur la branche de dv
# ------------------------------------------------------------
git checkout dev

```

### 3.6. Création du kubeconfig afin de permette une communication sécurisé entre notre cluster et gitHub. 
- voir : [Voir la documentation kubeconfig](kubeconfig.md)
- Mettre ce fichier dans le répertoire K8S de votre projet. 



## 4. Structure du projet

Tu devrais voir une structure similaire à :

```text
.
├─ app/
│  ├─ package.json
│  ├─ server.js        # Application Node.js "hello world"
├─ Dockerfile
├─ k8s/
│  ├─ deployment.yaml
├─ .github/
│  └─ workflows/
│     └─ ci-cd.yaml
└─ README.md
```

> Si certains fichiers manquent, ils seront créés dans les étapes suivantes.

---

## 5. Comprendre l’application

L’application est une petite appli Node.js qui expose un serveur HTTP sur le port `3000` et affiche un message (par exemple `"hello world"`).

Pour la tester localement (optionnel) :

```bash
cd app
npm install
npm start
```

Puis, dans le navigateur de la VM, test cette url.
`http://localhost:3000`

---

## 6. Dockeriser l’application

### 6.1. Vérifier le Dockerfile

Ouvre le fichier `Dockerfile` à la racine du projet. Il devrait ressembler à ceci avec des commentaires pour aider à votre compréhension :

```Dockerfile
FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --only=production

COPY . .

EXPOSE 3000

CMD ["node", "app/server.js"]
```

Ce fichier décrit comment construire l’image Docker de l’application.

---

## 7. Manifests Kubernetes

Les manifests Kubernetes décrivent comment déployer l’application dans le cluster k3s.

### 7.1. Fichier `k8s/deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hello-app
  namespace: dev
spec:
  replicas: 1
  selector:
    matchLabels:
      app: hello-app
      env: dev
  template:
    metadata:
      labels:
        app: hello-app
        env: dev
    spec:
      containers:
        - name: hello-app
          image: DOCKER_HUB_USERNAME/hello-app:dev
          ports:
            - containerPort: 3000
          env:
            - name: APP_ENV
              value: dev
          resources:
            requests:
              cpu: "50m"
              memory: "64Mi"
            limits:
              cpu: "200m"
              memory: "128Mi"
---
apiVersion: v1
kind: Service
metadata:
  name: hello-app
  namespace: dev
spec:
  selector:
    app: hello-app
    env: dev
  ports:
    - port: 80
      targetPort: 3000
      protocol: TCP
  type: ClusterIP
---
apiVersion: v1
kind: Ingress
metadata:
  name: hello-app
  namespace: dev
  annotations:
    kubernetes.io/ingress.class: "traefik"
spec:
  rules:
# ajouter dans le /etc/host
# 192.168.21.100 hello.cluster.local
    - host: hello.cluster.local
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: hello-app
                port:
                  number: 80
```

> **Important :**  
> `DOCKER_HUB_USERNAME` sera remplacé automatiquement par ton vrai nom Docker Hub dans le pipeline.
> C'est une des variables que vous allez créer au point 8.2.

### 7.2. Fichiers `k8s/deployment-qa.yaml` et `k8s/deployment-prod.yaml`

Vous devez les faire et ils devraient être similaires, mais avec :

- `namespace: qa` et tag `:qa` pour `deployment-qa.yaml`
- `namespace: prod` et tag `:prod` pour `deployment-prod.yaml`

---

## 8. Configuration des secrets GitHub

Les secrets permettent de stocker des informations sensibles (mots de passe, tokens, kubeconfig) sans les mettre dans le code.

### 8.1. Créer un token Docker Hub

1. Connecte-toi à **Docker Hub**.
2. Va dans **Account Settings ** dans le coin droit sur l'avatar de ton compte.
3. Aller sur Personal access tokens dans le menu et cliquez sur Generate new token.
4. Entrer un les informations demandées comme ceci :
<br><br>
<img width="664" height="401" alt="image" src="https://github.com/user-attachments/assets/2839f9e6-1a6f-46c5-bc0b-c85213f37f66" />
<br><br>
5. Copie ce token pour l'utiliser plus tard (tu ne pourras plus le revoir après, donc copie le dans un fichier txt).

### 8.2. Ajouter les secrets dans ton dépôt GitHub

Dans ton dépôt GitHub :

1. Va dans **Settings**.
2. Dans le menu de gauche, clique sur **Secrets and variables → Actions**.
3. Clique sur **New repository secret** et crée les secrets suivants :

- `DOCKERHUB_USERNAME`  
  → ton nom d’utilisateur Docker Hub (ex. `danny123`)

- `DOCKERHUB_TOKEN`  
  → le token Docker Hub que tu as créé

- `KUBECONFIG_CONTENT`  
  → colle ici **tout le contenu** du fichier KUBECONFIG fourni dans le projet

---

## 9. Workflow GitHub Actions

Le workflow GitHub Actions est un fichier YAML qui décrit les étapes du pipeline CI/CD.

### 9.1. Fichier `.github/workflows/ci-cd.yaml`

Ouvre le fichier, il y a des commentaires pour t'aider à le comprendre :

```yaml
name: CI/CD k3s + Docker Hub

on:
  push:
    branches: [ "dev", "qa", "main" ]

env:
  REGISTRY: docker.io
  IMAGE_NAME: ${{ secrets.DOCKERHUB_USERNAME }}/hello-app

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Set image tag based on branch
        id: vars
        run: |
          if [ "${GITHUB_REF_NAME}" = "dev" ]; then
            echo "TAG=dev" >> $GITHUB_OUTPUT
            echo "K8S_ENV=dev" >> $GITHUB_OUTPUT
          elif [ "${GITHUB_REF_NAME}" = "qa" ]; then
            echo "TAG=qa" >> $GITHUB_OUTPUT
            echo "K8S_ENV=qa" >> $GITHUB_OUTPUT
          else
            echo "TAG=prod" >> $GITHUB_OUTPUT
            echo "K8S_ENV=prod" >> $GITHUB_OUTPUT
          fi

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ env.IMAGE_NAME }}:${{ steps.vars.outputs.TAG }}

      - name: Install kubectl
        run: |
          curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
          chmod +x kubectl
          sudo mv kubectl /usr/local/bin/kubectl

      - name: Configure kubeconfig
        run: |
          echo "${{ secrets.KUBECONFIG_CONTENT }}" > kubeconfig
          export KUBECONFIG=$PWD/kubeconfig
          echo "KUBECONFIG=$PWD/kubeconfig" >> $GITHUB_ENV

      - name: Update image in manifest
        run: |
          sed -i "s|DOCKER_HUB_USERNAME/hello-app:${{ steps.vars.outputs.TAG }}|${{ env.IMAGE_NAME }}:${{ steps.vars.outputs.TAG }}|g" k8s/deployment-${{ steps.vars.outputs.K8S_ENV }}.yaml

      - name: Apply Kubernetes manifests
        run: |
          kubectl apply -f k8s/deployment-${{ steps.vars.outputs.K8S_ENV }}.yaml
```

**Ce que fait ce workflow :**

1. Récupère le code (`checkout`).
2. Se connecte à Docker Hub.
3. Choisis un tag d’image selon la branche (`dev`, `qa`, `prod`).
4. Construis et pousse l’image Docker vers Docker Hub.
5. Installe `kubectl`.
6. Configure l’accès au cluster avec le kubeconfig.
7. Mets à jour le manifest Kubernetes avec le bon nom d’image.
8. Applique le manifest dans le bon namespace.

---

## 10. Étapes du labo – Ce que vous devez faire

### Étape 1 – Vérifier que tout est en place

- Le dépôt est forké et cloné.
- Les fichiers `Dockerfile`, `k8s/*.yaml` et `.github/workflows/ci-cd.yaml` existent.
- Les secrets GitHub sont configurés (`DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `KUBECONFIG_CONTENT`).

---
- Faire un test
- construire l'image initial (Change dockerhub_username pour ton compte dockerhub)
```
docker login -u "ton User dockerHub"
newgrp docker
sudo usermod -aG docker $USER
sudo groupadd docker
docker build -t dockerhub_username/hello-app:dev .
docker push dockerhub_username/hello-app:dev
```
- Faire un déploiement initial sur K3S sur le namespace de dev
- Faite une nouvelle version du fichier deploiyement.yaml
- Changer la variable DOCKER_HUB_ pour la valeur.
- kubectl apply -f deploiyement.yaml

---
#### 1.1 Création d’un runner self‑hosted GitHub Actions

##### Ouvre la vm RunnerGitHubActions, c'est dans cette VM que tu entreras les commandes.

Dans ton dépôt GitHub :

a. Ouvre **Settings**
b. Va dans **Actions**
c. Clique sur **Runners**
d. Sélectionne **New self-hosted runner**

#### 1.2. Choisir la plateforme
- **OS :** Linux  
- **Architecture :** x64

GitHub affichera ensuite une série de commandes à exécuter sur ta vm RunnerGitHubActions

#### 1.3. Exécuter les commandes fournies par GitHub
Suis exactement les commandes affichées dans l’interface GitHub, par exemple :

** à la commande :  ./config.sh --url https://github.com/danbran99/CICD2026 --token AM3ASTNJXWZT4LOWxxxxxxxxxxxxxx
- Fais que des retours chariot pour avoir les valeurs par défauts.

### Étape 2 – Modifier le message de l’application

1. Ouvre `app/server.js`.
2. Repère le texte `"hello world"`.
3. Modifie-le, par exemple :

- Pour la branche `dev` : `"Bonjour de l'environnement de DEV"`

> Tu peux commencer par `dev`, puis refaire plus tard pour `qa` et `main`.

### Étape 3 – Pousser sur la branche `dev`

Dans le terminal, à la racine du projet :

```bash
git checkout dev
git add .
git commit -m "Changer le message pour dev"
git push origin dev
```

### Étape 4 – Observer le pipeline GitHub Actions
#### 4.1 Activer les git action
1. Cliquer sur Actions sur la barre horizontale
2. Cliquer sur le bouton
<img width="874" height="341" alt="image" src="https://github.com/user-attachments/assets/81602ccb-dc6a-4195-917f-e087b9dc0772" />
<br>

#### 4.2 Test de l'action
1. Va sur ton dépôt GitHub.
2. Clique sur l’onglet **Actions**.
3. Tu devrais voir un workflow nommé **CI/CD k3s + Docker Hub** en cours d’exécution.
4. Attends qu’il passe au **vert** (succès).  
   - S’il est **rouge**, clique dessus pour lire les logs et comprendre l’erreur.

### Étape 5 – Vérifier le déploiement dans k3s (namespace `dev`)

Sur la VM control-plane (terminal) :

```bash
kubectl get pods -n dev
kubectl get svc -n dev
```

Tu devrais voir un pod `hello-app-dev` et un service `hello-app-dev`.

Pour tester l’application :

```bash
kubectl port-forward svc/hello-app-dev -n dev 8080:80
```

Puis, dans le navigateur de la VM :  
`http://localhost:8080`

Tu dois voir le message que tu as configuré pour `dev`.

### Étape 6 – Refaire pour `qa` et `prod`

1. Modifie le message dans `server.js` pour `qa`.
2. Bascule sur la branche `qa` :

```bash
git checkout qa
# merge ou re-appliquer la modification selon les consignes du prof
git add .
git commit -m "Change message for qa"
git push origin qa
```

3. Vérifie le pipeline dans l’onglet **Actions**.
4. Vérifie le namespace `qa` :

```bash
kubectl get pods -n qa
kubectl port-forward svc/hello-app-qa -n qa 8081:80
```

5. Refaire la même logique pour `main` → namespace `prod`.

---

## 11 . Tool-Tip

Pour redémarrer tous les pods d'un déploiement pour forcer l'utilisation d'une nouvelle image

kubectl rollout restart deployment hello-app -n dev

## 12. Pour aller plus loin (optionnel)

Si tu as terminé en avance, tu peux :

- Ajouter une étape **tests** dans le CICD qui vérifier le code.

---
