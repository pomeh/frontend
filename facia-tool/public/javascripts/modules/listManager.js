define([
    'Config',
    'knockout',
    'models/common',
    'models/droppable',
    'models/authedAjax',
    'models/collection',
    'models/article',
    'models/latestArticles',
    'models/contentApi',
    'models/ophanApi'
], function(
    Config,
    ko,
    common,
    droppable,
    authedAjax,
    Collection,
    Article,
    LatestArticles,
    contentApi,
    ophanApi
) {
    var prefKeyDefaultMode = 'gu.frontsTool.defaultToLiveMode';

    return function(selector) {

        var self = this,
            model = {
                collections: ko.observableArray(),
                configs: ko.observableArray(),
                config: ko.observable(),

                latestArticles: new LatestArticles({
                    filterTypes: common.config.filterTypes
                }),

                clipboard: {
                    articles: ko.observableArray(),
                    underDrag: ko.observable(),
                    callback: updateLayout,
                    dropItem: function(item) {
                        model.clipboard.articles.remove(item);
                        updateLayout();
                    },
                    keepCopy:  true
                },

                liveMode: common.state.liveMode
            };

        if (window.localStorage && window.localStorage.getItem(prefKeyDefaultMode)) {
            model.liveMode(window.localStorage.getItem(prefKeyDefaultMode) === '1');
        }

        model.setModeLive = function() {
            model.liveMode(true);
            if (window.localStorage) { 
                window.localStorage.setItem(prefKeyDefaultMode, '1');
            }
        }

        model.setModeDraft = function() {
            model.liveMode(false);
            if (window.localStorage) { 
                window.localStorage.setItem(prefKeyDefaultMode, '0');
            }
        }

        model.previewUrl = ko.computed(function() {
            return common.config.viewer[Config.env] + '/responsive-viewer#env=' + Config.env + '&url=' + model.config() + encodeURIComponent('?view=mobile');
        })

        function fetchConfigsList() {
            return authedAjax.request({
                url: common.config.apiBase + '/config'
            }).then(function(resp) {
                if (!(_.isArray(resp) && resp.length > 0)) {
                    window.alert("Oops, no page definitions were found! Please contact support.");
                    return;
                }
                model.configs(resp.sort());
            });
        };

        function getConfig() {
            return common.util.queryParams().front;
        }

        function setConfig(id) {
            history.pushState({}, "", window.location.pathname + '?' + common.util.ammendedQueryStr('front', id));
            renderCollections();
        }

        function renderConfig() {
            model.config(getConfig());
        }

        function renderCollections() {
            model.collections.removeAll();

            if (!getConfig()) { return; }

            authedAjax.request({
                url: common.config.apiBase + '/config/' + getConfig()
            })
            .then(function(collections){
                model.collections(
                    (collections || []).map(function(collection){
                        return new Collection(collection);
                    })
                );
                //connectSortableLists();
            });
        }

        function startPoller() {
            var period = common.config.collectionsPollMs || 60000;

            setInterval(function(){
                model.collections().forEach(function(list, index){
                    setTimeout(function(){
                        list.refresh();
                    }, index * period / (model.collections().length + 1)); // stagger requests
                });
            }, period);

            startPoller = function() {}; // make idempotent
        }

        ko.bindingHandlers.sparkline = {
            update: function (element, valueAccessor, allBindingsAccessor, model) {
                var graphs = ko.utils.unwrapObservable(valueAccessor()),
                    max;

                if (!_.isArray(graphs)) { return; };
                max = _.max(_.pluck(graphs, 'max'));
                if (!max) { return; };

                _.each(_.toArray(graphs).reverse(), function(graph, i){
                    $(element).sparkline(graph.data, {
                        chartRangeMax: max,
                        defaultPixelsPerValue: graph.data.length < 50 ? graph.data.length < 30 ? 3 : 2 : 1,
                        height: Math.round(Math.max(10, Math.min(40, max))),
                        lineColor: '#' + graph.color,
                        spotColor: false,
                        minSpotColor: false,
                        maxSpotColor: false,
                        lineWidth: graph.activity || 1,
                        fillColor: false,
                        composite: i > 0
                    });
                });
            }
        };

        model.config.subscribe(function(next) {
            var previous = getConfig(), // previous config is still in queryStr
                section;

            if (Config.env.toLowerCase() === 'prod'
                &&  next
                && !next.match(/sandbox/) 
                &&(!previous || previous.match(/sandbox/)) 
                && !window.confirm("BEWARE! You are about to edit a LIVE page")) {
                
                model.config(previous);
                return;
            }

            setConfig(next);
        });

        model.liveMode.subscribe(function() {
            _.each(model.collections(), function(collection) {
                collection.populateLists();
            });
        });
        
        function updateLayout() {
            var height = $(window).height();
            $('.scrollable').each(function() {
                $(this).height(Math.max(100, height - $(this).offset().top) - 2)
            });
        };

        this.init = function() {
            droppable.init();

            fetchConfigsList()
            .then(function(){
                renderConfig();
                window.onpopstate = renderConfig;

                ko.applyBindings(model);

                updateLayout();
                window.onresize = updateLayout;

                startPoller();

                model.latestArticles.search();
                model.latestArticles.startPoller();
            });
        };

    };

});
