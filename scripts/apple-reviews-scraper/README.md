# Apple App Store Reviews Scraper

Extrai avaliações (conteúdo, nota e data) de qualquer app na App Store,
usando a API JSON pública que o próprio site `apps.apple.com` usa para
renderizar as avaliações. Abordagem baseada em
[glennfang/apple-app-reviews-scraper](https://github.com/glennfang/apple-app-reviews-scraper):
paginação via `offset` e backoff exponencial nas respostas `429 API capacity exceeded`.

## Uso

```bash
python3 scrape.py --url "https://apps.apple.com/br/app/vivo-fatura-suporte-e-mais/id475915064" --count 300 --out reviews.csv
```

ou informando país/app id diretamente:

```bash
python3 scrape.py --country br --app-id 475915064 --count 300 --out reviews.json
```

## Saída

Cada avaliação contém: `id`, `date` (ISO 8601), `rating`, `title`, `review`
(conteúdo do texto), `userName` e `isEdited`.

## Observações

- A Apple não oferece ordenação garantida por data mais recente/antiga nesse
  endpoint; o `offset` tende a trazer avaliações mais antigas conforme
  aumenta, mas sem garantia estrita.
- O endpoint tem rate limiting (`429`); o script já faz backoff automático.
