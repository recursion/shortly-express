Shortly.loginView = Backbone.View.extend({
  className: 'login',

  template: Templates['login'],

  render: function() {
    this.$el.html(this.template());
    return this;
  }
});


