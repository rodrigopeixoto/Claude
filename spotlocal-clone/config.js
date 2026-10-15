/* SpotLocal · endereço do "cérebro" (servidor que faz os cálculos).
   Publicando o site e o cérebro juntos na Cloudflare Pages (recomendado), deixe "/api".
   Se o site ficar em outra hospedagem e o cérebro num Worker separado, troque pelo endereço do Worker + "/api",
   por exemplo "https://spotlocal-cerebro.SEU-USUARIO.workers.dev/api" (e acrescente esse endereço em connect-src
   no cabeçalho Content-Security-Policy). */
window.PC_API = "/api";

/* Fase grátis: @ do Instagram para o convite "siga em troca" (deixe "" para não mostrar). */
window.PC_INSTAGRAM = "";
