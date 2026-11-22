read -s -p "Password: " PASS && echo ""

openssl enc -d -aes-256-cbc -pbkdf2 -in env.tar.gz.enc -pass pass:"$PASS" | tar -xzf -

unset PASS
