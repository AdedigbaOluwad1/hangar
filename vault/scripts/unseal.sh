#!/bin/bash
export VAULT_ADDR=http://127.0.0.1:8200

# Wait for Vault to be ready
until vault status 2>/dev/null | grep -q "Initialized.*true"; do
  sleep 2
done

# Check if already unsealed
if vault status 2>/dev/null | grep -q "Sealed.*false"; then
  echo "Vault already unsealed"
  exit 0
fi

# Unseal
vault operator unseal $VAULT_UNSEAL_KEY_1
vault operator unseal $VAULT_UNSEAL_KEY_2
vault operator unseal $VAULT_UNSEAL_KEY_3

echo "Vault unsealed successfully"