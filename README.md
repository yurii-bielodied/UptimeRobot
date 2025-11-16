
## Структура репозиторію

```text
UptimeRobot/
  task_1/
    index.js
    package.json
    Dockerfile
    deployment-v1.yaml
    service.yaml
  task_2/
    index.js
    package.json
    Dockerfile
    deployment-v2.yaml
  README.md
```

**Завдання 1**

1. Розгорнути Kubernetes кластер на Google Cloud
# 1.1. Увімкнути потрібний проєкт
gcloud config set project <PROJECT_ID>

# 1.2. Обрати регіон/зону (приклад — європейська зона)
gcloud config set compute/zone europe-west4-a

# 1.3. Створити GKE-кластер
gcloud container clusters create version-cluster \
  --num-nodes=2 \
  --machine-type=e2-small # e2-medium

Після створення:

# 1.4. Забрати kubeconfig для kubectl
gcloud container clusters get-credentials version-cluster

# 1.5. Перевірити доступ
kubectl get nodes

2. Deployment v1.0.0 з відповіддю “Version: 1.0.0”
2.1. Структура проєкту

index.js:

const http = require('http');

const version = process.env.VERSION || '1.0.0';

const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end(`Version: ${version}\n`);
});

const port = process.env.PORT || 8080;
server.listen(port, () => {
  console.log(`Listening on port ${port}, version ${version}`);
});


package.json (мінімальний):

{
  "name": "version-app",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "http": "0.0.1-security"
  }
}


Dockerfile:

FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

ENV PORT=8080
EXPOSE 8080

CMD ["npm", "start"]

2.2. Збірка та push v1.0.0

Для авторизаціі використовуй docker login -u <username>

docker build -t <DOCKERHUB_USER>/version-app:v1.0.0 .     # docker build -t yurabeloded/version-app:v1.0.0 .
docker push <DOCKERHUB_USER>/version-app:v1.0.0           # docker push yurabeloded/version-app:v1.0.0

3. Deployment з образом v1.0.0

deployment-v1.yaml:

apiVersion: apps/v1
kind: Deployment
metadata:
  name: version-app-v1
spec:
  replicas: 1
  selector:
    matchLabels:
      app: version-app
      version: "1.0.0"
  template:
    metadata:
      labels:
        app: version-app
        version: "1.0.0"
    spec:
      containers:
        - name: version-app
          image: yurabeloded/version-app:v1.0.0
          env:
            - name: VERSION
              value: "1.0.0"
          ports:
            - containerPort: 8080

Застосувати:

kubectl apply -f deployment-v1.yaml
kubectl get pods -l app=version-app

4. Service типу LoadBalancer + отримати IP

service.yaml:

apiVersion: v1
kind: Service
metadata:
  name: version-app-lb
spec:
  type: LoadBalancer
  selector:
    app: version-app
  ports:
    - port: 80
      targetPort: 8080

Застосувати:

kubectl apply -f service.yaml

# Дочекатися EXTERNAL-IP
kubectl get svc version-app-lb -w


Коли в полі EXTERNAL-IP з’явиться адреса, перевір:

curl http://<EXTERNAL_IP>/      # curl http://34.12.93.193
# має повернути: Version: 1.0.0

Цю IP використовувати в UptimeRobot.

5. Monitor Type Keyword у Uptime Robot (v1.0.0)

У своєму акаунті UptimeRobot:

Add New Monitor

Monitor Type: Keyword

Friendly Name: напр. Version App v1

URL (or IP): http://<EXTERNAL_IP>/      # http://34.12.93.193

Keyword: Version: 1.0.0

Alert Contact: свій email (або дефолтний)

Зберегти.

6. Перевірка доступності та Status Page

Коли монітор почне показувати Up:

В UptimeRobot зайди в Status Pages → Add Status Page.

Введи:

Name: напр. Version App

Friendly URL: зроби красиво, напр. version-app-demo

У налаштуваннях статус-сторінки додай Monitoring:

Додай свій монітор Version App v1.

Збережи — отримаєш публічне посилання приблизно формату:

https://stats.uptimerobot.com/XXXXXXX       # https://stats.uptimerobot.com/vQS7pjFpQp

🔹 На цьому Завдання 1 закінчується.
Зараз сторінка містить історію перевірок для v1.0.0.


**Завдання 2**

7. Змінити програму на v2.0.0

Наприклад, просто поміняти значення версії за замовчуванням:

const version = process.env.VERSION || '2.0.0';


або поміняти текст.
Потім збілдити та запушити новий тег:

docker build -t <DOCKERHUB_USER>/version-app:v2.0.0 .     # docker build -t yurabeloded/version-app:v2.0.0 .
docker push <DOCKERHUB_USER>/version-app:v2.0.0           # docker push yurabeloded/version-app:v2.0.0

8. Новий Deployment з образом v2.0.0

deployment-v2.yaml:

apiVersion: apps/v1
kind: Deployment
metadata:
  name: version-app-v2
spec:
  replicas: 1
  selector:
    matchLabels:
      app: version-app
      version: "2.0.0"
  template:
    metadata:
      labels:
        app: version-app
        version: "2.0.0"
    spec:
      containers:
        - name: version-app
          image: yurabeloded/version-app:v2.0.0
          env:
            - name: VERSION
              value: "2.0.0"
          ports:
            - containerPort: 8080

kubectl apply -f deployment-v2.yaml
kubectl get pods -l app=version-app


Сервіс той самий, що в Завданні 1 (version-app-lb), з селектором app: version-app, тобто він бачить і v1, і v2.

9. Переклад трафіку: Canary 25% та Blue-Green 100%
9.1. Canary deployment (25% на v2.0.0)

Ідея: однаковий app, різні version і різна кількість реплік.

Для v1 (старий deployment) виставляємо, наприклад, 3 репліки:

kubectl scale deployment version-app-v1 --replicas=3


Для v2 залишаємо 1 репліку:

kubectl scale deployment version-app-v2 --replicas=1


Разом 4 поди: 3 з v1, 1 з v2 → приблизно 25% трафіку піде на v2.

Перевіряємо:

watch -n1 "curl -s http://<EXTERNAL_IP>/"       # watch -n1 "curl -s http://34.12.93.193/"


Ти маєш випадково час від часу бачити Version: 2.0.0.

Це й є Canary.

9.2. Blue-Green deployment (100% на v2.0.0)

Після того, як Canary показав, що v2 стабільна:

kubectl scale deployment version-app-v1 --replicas=0
kubectl scale deployment version-app-v2 --replicas=3

Сервіс version-app-lb досі дивиться на app=version-app, але живі поди тепер лише з v2. Увесь трафік = 100% на v2 → це і є Blue-Green (blue – v1, green – v2, ти просто переключився).

Перевір:

curl http://<EXTERNAL_IP>/       # watch -n1 "curl -s http://34.12.93.193/"
# завжди має бути Version: 2.0.0

10. Uptime Robot для v2.0.0 + Status Page
11. Новий Monitor Type Keyword (v2.0.0)

У UptimeRobot:

Add New Monitor

Monitor Type: Keyword

Friendly Name: Version App v2

URL (or IP): http://<EXTERNAL_IP>/

Keyword: Version: 2.0.0

Зберегти.

13. Додати другий монітор на Status Page

Зайти в налаштування вже створеної статус-сторінки:

Status Pages → Edit твоєї сторінки.

У списку monitor’ів додати:

Version App v1

Version App v2

Зберегти.

Через кілька хвилин на статус-сторінці буде видно історію:

коли була доступна Version: 1.0.0

з якого моменту стала Version: 2.0.0


**Видалення кластера. Дуже важливо!**

Подивитись список кластерів:

gcloud container clusters list


Припустимо, кластер називається version-cluster і в зоні europe-west4-a:

gcloud container clusters delete version-cluster \
  --zone europe-west4-a

Попросять підтвердити y.

Видалення кластера:

знищить усі namespace-и, deployments, services, pods в ньому

забере пов’язаний LoadBalancer, IP, ноди, автоскейлер тощо

Цього більш ніж достатньо.

Після видалення кластера:

gcloud container clusters list
