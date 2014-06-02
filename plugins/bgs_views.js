module.exports = {
  by_user: {
    map: function(doc) {
      if ('user' in doc) {
        emit(doc.user, doc);
      }
    }.toString()
  }
};