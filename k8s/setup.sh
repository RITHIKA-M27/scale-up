#!/bin/sh
# Run from the repo root inside a Kubernetes playground: sh k8s/setup.sh
set -e

echo "== Loading the app code into the cluster"
kubectl create configmap scale-lab-code \
  --from-file=server.js --from-file=index.html \
  --dry-run=client -o yaml | kubectl apply -f -

echo "== Starting the app and its load balancer"
kubectl apply -f k8s/app.yaml

echo "== Installing metrics-server (the autoscaler needs it to read CPU use)"
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
# Playground clusters use self-signed certificates, so skip that check.
kubectl -n kube-system patch deployment metrics-server --type=json \
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'

echo "== Waiting for the app"
kubectl rollout status deployment/scale-lab --timeout=180s

echo
echo "Ready. Next, follow the steps in README.md, starting with:"
echo "  URL=http://\$(kubectl get svc scale-lab -o jsonpath='{.spec.clusterIP}')"
echo "  curl -s \$URL/api/whoami"
