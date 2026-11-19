# Scale Lab

A tiny backend for learning load balancing and autoscaling hands-on.
Every running copy of the server has its own ID and reports it in each
response, so you can see which copy answered.

| Endpoint | What it does |
|---|---|
| `/` | Page with a load-test button and a counter demo |
| `/api/whoami` | Which instance answered |
| `/api/work?ms=300&cpu=100` | Slow request: waits `ms`, burns CPU for `cpu` |
| `/api/counter` | Adds 1 to a counter kept in that instance's memory |

## Run on your own machine

```
node server.js
```

Open http://localhost:8080.

## Kubernetes lab (free, no card)

Open a Kubernetes playground at https://killercoda.com/playgrounds
(sign in with GitHub). In its terminal:

### 1. Set up

```
git clone https://github.com/RITHIKA-M27/scale-lab
cd scale-lab
sh k8s/setup.sh
URL=http://$(kubectl get svc scale-lab -o jsonpath='{.spec.clusterIP}')
```

### 2. One instance

```
for i in $(seq 10); do curl -s $URL/api/whoami; echo; done
```

Every line shows the same `instance`.

### 3. Scale by hand: the "toggle"

```
kubectl scale deployment scale-lab --replicas=3
kubectl get pods
```

Run the loop from step 2 again. Three different instances now take turns:
that is the load balancer (the Kubernetes Service) at work.

### 4. The in-memory state problem

```
for i in $(seq 10); do curl -s $URL/api/counter; echo; done
```

The counter jumps around instead of going 1 to 10, because each instance
keeps its own count. Anything shared must live outside the server
(a database or Redis).

### 5. Failover

```
kubectl delete pod $(kubectl get pods -l app=scale-lab -o name | head -1)
kubectl get pods
```

Requests keep working, and Kubernetes starts a replacement pod.

### 6. Autoscaling

```
kubectl scale deployment scale-lab --replicas=1
kubectl apply -f k8s/autoscale.yaml
kubectl apply -f k8s/load.yaml
kubectl get hpa scale-lab --watch
```

Within a minute or two, CPU goes above the 50% target and REPLICAS climbs
(up to 5). Press Ctrl+C, then stop the load and watch it shrink again:

```
kubectl delete -f k8s/load.yaml
kubectl get hpa scale-lab --watch
```

If TARGETS shows `<unknown>`, metrics-server is still starting; wait a minute.

### 7. See the page

In Killercoda, open the menu at the top right, choose **Traffic / Ports**,
and enter port `30080`.

## Load test from your machine

```
node loadtest.js <base-url> [concurrency=50] [seconds=30] [work-ms=300]
```

## Cloud Run (needs a billing account)

```
gcloud run deploy scale-lab --source . --region asia-south1 --allow-unauthenticated --concurrency 5 --max-instances 5
```
