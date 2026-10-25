// Regra de qualificação. Roda no navegador (window.FQualify) e no servidor (require):
// o navegador usa para decidir se pede o contato, o servidor tem a palavra final.
(function (root) {
  // Ordem de prioridade: uma resposta que manda para o material vence uma que manda para o downsell
  const RANK = { qualified: 0, downsell: 1, material: 2 };

  function chosenOption(question, value) {
    return question.options.find((o) => o.value === value);
  }

  // Devolve os ids das perguntas com resposta ausente ou fora das opções configuradas
  function invalidAnswers(quiz, answers) {
    const bad = [];
    for (const q of quiz.questions) {
      if (!chosenOption(q, answers[q.id])) bad.push(q.id);
    }
    return bad;
  }

  function outcome(quiz, answers) {
    let result = 'qualified';
    for (const q of quiz.questions) {
      const opt = chosenOption(q, answers[q.id]);
      const o = opt && opt.outcome;
      if (o && RANK[o] > RANK[result]) result = o;
    }
    return result;
  }

  const api = { outcome, invalidAnswers, RANK };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FQualify = api;
})(typeof self !== 'undefined' ? self : this);
