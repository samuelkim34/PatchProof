import sqlite3

def authenticate(username, password):
    conn = sqlite3.connect(":memory:")
    try:
        conn.execute("CREATE TABLE users (username TEXT, password TEXT)")
        conn.execute("INSERT INTO users VALUES (?, ?)", ("admin", "demo-password-123"))
        query = f"SELECT username FROM users WHERE username = '{username}' AND password = '{password}'"
        return conn.execute(query).fetchone() is not None
    finally:
        conn.close()
