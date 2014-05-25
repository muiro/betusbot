module.exports = {
  by_hostmask: {
    map: function(doc) {
      if ('hostmasks' in doc) {
        doc.hostmasks.forEach(emit);
      }
    }.toString()
  }
};