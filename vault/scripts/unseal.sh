#!/bin/bash
export VAULT_ADDR=https://127.0.0.1:8200
export VAULT_SKIP_VERIFY=true

INIT_FILE=/etc/vault.d/keys/init.json

KEY1=$(jq -r '.unseal_keys_b64[0]' $INIT_FILE)
KEY2=$(jq -r '.unseal_keys_b64[1]' $INIT_FILE)
KEY3=$(jq -r '.unseal_keys_b64[2]' $INIT_FILE)

vault operator unseal $KEY1
vault operator unseal $KEY2
vault operator unseal $KEY3