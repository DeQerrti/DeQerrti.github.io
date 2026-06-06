<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TasteID — Вход</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Cormorant+Garamond:wght@300;400;600&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<style>
:root {
  --bg: #1a1510; --surface: #28211a; --border: #3d3228; --border2: #554535;
  --gold: #c9a84c; --gold-dim: #7a5e28; --gold-hi: #e8c96a;
  --text: #c8b99a; --text-dim: #6b5e4a; --text-hi: #ede0c8;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--bg); color: var(--text); font-family: 'Cormorant Garamond', serif; min-height: 100vh; display: flex; align-items: center; justify-content: center;
  background-image: radial-gradient(ellipse 80% 50% at 50% 0%, rgba(201,168,76,.06) 0%, transparent 60%); }
.box { background: var(--surface); border: 1px solid var(--border); border-radius: 4px; padding: 2.5rem 2.5rem 2rem; width: 100%; max-width: 380px; position: relative; }
.box::before { content: ''; position: absolute; top: -1px; left: -1px; width: 20px; height: 20px; border-top: 2px solid var(--gold-dim); border-left: 2px solid var(--gold-dim); }
.box::after  { content: ''; position: absolute; bottom: -1px; right: -1px; width: 20px; height: 20px; border-bottom: 2px solid var(--gold-dim); border-right: 2px solid var(--gold-dim); }
.title { font-family: 'Playfair Display', serif; font-size: 1.6rem; font-weight: 900; font-style: italic; color: var(--gold-hi); text-align: center; margin-bottom: .4rem; }
.sub { font-size: .78rem; color: var(--text-dim); text-align: center; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 2rem; font-family: 'DM Sans', sans-serif; }
label { font-family: 'DM Sans', sans-serif; font-size: .72rem; color: var(--text-dim); letter-spacing: .08em; text-transform: uppercase; display: block; margin-bottom: .4rem; }
input { width: 100%; background: #1a1510; border: 1px solid var(--border2); border-radius: 2px; padding: .7rem .9rem; color: var(--text-hi); font-family: 'Cormorant Garamond', serif; font-size: 1rem; outline: none; transition: border-color .2s; margin-bottom: 1.25rem; }
input:focus { border-color: var(--gold-dim); }
button { width: 100%; background: rgba(201,168,76,.1); border: 1px solid rgba(201,168,76,.3); border-radius: 2px; color: var(--gold-hi); font-family: 'Cormorant Garamond', serif; font-size: 1rem; font-weight: 600; letter-spacing: .1em; padding: .75rem; cursor: pointer; transition: background .2s, border-color .2s; }
button:hover { background: rgba(201,168,76,.2); border-color: var(--gold); }
.error { font-family: 'DM Sans', sans-serif; font-size: .75rem; color: #e07070; text-align: center; margin-top: .75rem; min-height: 1.1rem; }
</style>
</head>
<body>
<div class="box">
  <div class="title">TasteID</div>
  <div class="sub">Административный вход</div>
  <label>Пароль</label>
  <input type="password" id="pwd" placeholder="••••••••" onkeydown="if(event.key==='Enter')login()">
  <button onclick="login()">Войти</button>
  <div class="error" id="err"></div>
</div>
<script>
async function login() {
  const pwd = document.getElementById("pwd").value;
  const err = document.getElementById("err");
  if (!pwd) { err.textContent = "Введите пароль"; return; }
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: pwd })
  });
  if (res.ok) {
    window.location.href = "/add";
  } else {
    err.textContent = "Неверный пароль";
    document.getElementById("pwd").value = "";
  }
}
</script>
</body>
</html>
