# パスワードを環境変数に一時保存（毎回入力する手間を省くため）
read -s -p "Password: " PASS && echo ""

# カレントディレクトリの対象ファイルをループで暗号化
tar -czf - .env .env.local transit-config.json app-config.local.json app-config.json | openssl enc -aes-256-cbc -salt -pbkdf2 -out env.tar.gz.enc  -pass pass:"$PASS"

# セキュリティのため変数を削除
unset PASS
