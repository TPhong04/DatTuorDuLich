const { products } = require('../data/tours');

// GET /search?q=...
function searchTours(req, res) {
  const keyword = (req.query.q || '').trim();
  let results = [];

  if (keyword) {
    results = products.filter(p =>
      p.name.toLowerCase().includes(keyword.toLowerCase()) ||
      p.category.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  res.render('search', {
    title: 'Tìm kiếm',
    keyword,
    results,
    resultsCount: results.length,
    hasResults: results.length > 0, 
    searched: keyword.length > 0
  });
}

module.exports = { searchTours };