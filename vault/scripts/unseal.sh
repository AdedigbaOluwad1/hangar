#!/bin/bash
export VAULT_ADDR=https://127.0.0.1:8200
export VAULT_SKIP_VERIFY=true

until vault status 2>/dev/null | grep -q "Initialized.*true"; do
  sleep 2
done

if vault status 2>/dev/null | grep -q "Sealed.*false"; then
  echo "Vault already unsealed"
  exit 0
fi

vault operator unseal $VAULT_UNSEAL_KEY_1
vault operator unseal $VAULT_UNSEAL_KEY_2
vault operator unseal $VAULT_UNSEAL_KEY_3

echo "Vault unsealed successfully"