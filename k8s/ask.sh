#!/bin/sh
# Ask the app 10 times and show which instance answered each time.
# Usage: sh k8s/ask.sh            (which instance?)
#        sh k8s/ask.sh counter    (the in-memory counter)
WHAT=${1:-whoami}
IP=$(kubectl get svc scale-lab -o jsonpath='{.spec.clusterIP}')
for i in $(seq 10); do
  curl -s "http://$IP/api/$WHAT" \
    | grep -o '"\(instance\|counter\)":[^,}]*' | tr '\n' ' '
  echo
done
