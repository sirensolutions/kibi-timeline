const sinon = require('auto-release-sinon');
const angular = require('angular');
const expect = require('expect.js');
const _ = require('lodash');
const ngMock = require('ngMock');
const moment = require('moment');

require('plugins/kibi_timeline_vis/kibi_timeline_vis_controller');

let $rootScope;
let $scope;
let searchSource;
let highlightTags;

const init = function ($elem, props) {
  ngMock.inject(function (_$rootScope_, $compile) {
    $rootScope = _$rootScope_;
    $compile($elem)($rootScope);
    $elem.scope().$digest();
    $scope = $elem.isolateScope();
    _.assign($scope, props);
    $scope.$digest();
  });
};

const destroy = function () {
  $scope.$destroy();
  $rootScope.$destroy();
};

describe('KibiTimeline Directive', function () {
  let $elem;

  function initTimeline({ useHighlight = false, withFieldSequence, endField, startField, labelField }) {
    ngMock.module('kibana', $provide => {
      $provide.constant('kbnDefaultAppId', '');
      $provide.constant('kibiDefaultDashboardTitle', '');
      $provide.constant('elasticsearchPlugins', ['siren-join']);
    });
    const directive = `<kibi-timeline
                        vis-options="visOptions"
                        timeline-options="timelineOptions">
                      </kibi-timeline>`;
    $elem = angular.element(directive);
    ngMock.inject(function (_highlightTags_, Private) {
      highlightTags = _highlightTags_;
      searchSource = Private(require('fixtures/stubbed_search_source'));
      searchSource.highlight = sinon.stub();
    });

    const params = { useHighlight, endField, labelField, startField };
    if (withFieldSequence) {
      params.startFieldSequence = startField.split('.');
      params.endFieldSequence = endField.split('.');
      params.labelFieldSequence = labelField.split('.');
    }

    init($elem, {
      visOptions: {
        groups: [
          {
            id: 1,
            color: '#ff0000',
            label: 'logs',
            params,
            searchSource
          }
        ],
        groupsOnSeparateLevels: false,
        selectValue: 'id',
        notifyDataErrors: false
      }
    });
    $scope.$digest();
  }

  afterEach(function () {
    destroy();
  });

  it('should compile', function () {
    initTimeline({});
    expect($elem.text()).to.not.be.empty();
  });

  it('should correctly return a timeline', function () {
    initTimeline({
      startField: '@timestamp',
      endField: '',
      labelField: 'machine.os'
    });

    const date = '25-01-1995';
    const dateObj = moment(date, 'DD-MM-YYYY');
    const results = {
      took: 73,
      timed_out: false,
      _shards: {
        total: 144,
        successful: 144,
        failed: 0
      },
      hits: {
        total : 49487,
        max_score : 1.0,
        hits: [
          {
            _index: 'logstash-2014.09.09',
            _type: 'apache',
            _id: '61',
            _score: 1,
            _source: {
              '@timestamp': date,
              machine: {
                os: 'linux'
              }
            },
            fields: {
              '@timestamp': [ dateObj ]
            }
          }
        ]
      }
    };
    searchSource.crankResults(results);
    $scope.$digest();
    expect($scope.timeline.itemsData.length).to.be(1);
    $scope.timeline.itemsData.forEach(data => {
      sinon.assert.notCalled(searchSource.highlight);
      expect(data.value).to.be('linux');
      expect(data.start.valueOf()).to.be(dateObj.valueOf());
    });
  });

  it('should correctly return a timeline if multivalued fields', function () {
    initTimeline({
      startField: '@timestamp',
      endField: '',
      labelField: 'machine.os'
    });

    var dates = [ '25-01-2015', '16-12-2016' ];
    var dateObjs = [ moment(dates[0], 'DD-MM-YYYY'), moment(dates[1], 'DD-MM-YYYY') ];
    const results = {
      took: 73,
      timed_out: false,
      _shards: {
        total: 144,
        successful: 144,
        failed: 0
      },
      hits: {
        total : 49487,
        max_score : 1.0,
        hits: [
          {
            _index: 'logstash-2014.09.09',
            _type: 'apache',
            _id: '61',
            _score: 1,
            _source: {
              '@timestamp': [ dates[0], dates[1] ],
              machine: {
                os: 'linux'
              }
            },
            fields: {
              '@timestamp': [ dateObjs[0], dateObjs[1] ]
            }
          }
        ]
      }
    };
    searchSource.crankResults(results);
    $scope.$digest();
    expect($scope.timeline.itemsData.length).to.be(2);
    var i = 0;
    $scope.timeline.itemsData.forEach(data => {
      sinon.assert.notCalled(searchSource.highlight);
      expect(data.value).to.be('linux');
      expect(data.start.valueOf()).to.be(dateObjs[i].valueOf());
      i++;
    });
  });

  it('should get the highlighted terms of events if useHighlight is true', function () {
    initTimeline({
      useHighlight: true,
      startField: '@timestamp',
      endField: '',
      labelField: 'machine.os'
    });

    const date = '25-01-1995';
    const dateObj = moment(date, 'DD-MM-YYYY');
    const results = {
      took: 73,
      timed_out: false,
      _shards: {
        total: 144,
        successful: 144,
        failed: 0
      },
      hits: {
        total : 49487,
        max_score : 1.0,
        hits: [
          {
            _index: 'logstash-2014.09.09',
            _type: 'apache',
            _id: '61',
            _score: 1,
            _source: {
              '@timestamp': date,
              machine: {
                os: 'linux'
              }
            },
            fields: {
              '@timestamp': [ dateObj ]
            },
            highlight: {
              'machine.os': [
                `${highlightTags.pre}BEST BEST${highlightTags.post}`
              ]
            }
          }
        ]
      }
    };
    searchSource.crankResults(results);
    $scope.$digest();
    expect($scope.timeline.itemsData.length).to.be(1);
    $scope.timeline.itemsData.forEach(data => {
      sinon.assert.called(searchSource.highlight);
      expect(data.content).to.match(/best best/);
      expect(data.value).to.be('linux');
      expect(data.start.valueOf()).to.be(dateObj.valueOf());
    });
  });

  describe('Missing data', function () {
    it('should support documents with missing label', function () {
      initTimeline({
        startField: '@timestamp',
        endField: '',
        labelField: 'machine.os'
      });

      const date = '25-01-1995';
      const dateObj = moment(date, 'DD-MM-YYYY');
      const results = {
        took: 73,
        timed_out: false,
        _shards: {
          total: 144,
          successful: 144,
          failed: 0
        },
        hits: {
          total : 49487,
          max_score : 1.0,
          hits: [
            {
              _index: 'logstash-2014.09.09',
              _type: 'apache',
              _id: '61',
              _score: 1,
              _source: {
                '@timestamp': date
              },
              fields: {
                '@timestamp': [ dateObj ]
              }
            }
          ]
        }
      };
      searchSource.crankResults(results);
      $scope.$digest();
      expect($scope.timeline.itemsData.length).to.be(1);
      $scope.timeline.itemsData.forEach(data => {
        sinon.assert.notCalled(searchSource.highlight);
        expect(data.value).to.be('N/A');
        expect(data.start.valueOf()).to.be(dateObj.valueOf());
      });
    });

    [
      {
        withFieldSequence: true
      },
      {
        withFieldSequence: false
      }
    ].forEach(({ withFieldSequence }) => {
      it(`should support documents with missing start date with ${withFieldSequence ? 'kibi' : 'kibana'}`, function () {
        initTimeline({
          withFieldSequence,
          startField: '@timestamp',
          endField: '',
          labelField: 'machine.os'
        });

        const results = {
          took: 73,
          timed_out: false,
          _shards: {
            total: 144,
            successful: 144,
            failed: 0
          },
          hits: {
            total : 49487,
            max_score : 1.0,
            hits: [
              {
                _index: 'logstash-2014.09.09',
                _type: 'apache',
                _id: '61',
                _score: 1,
                _source: {
                  '@timestamp': null,
                  machine: {
                    os: 'linux'
                  }
                },
                fields: {}
              }
            ]
          }
        };
        searchSource.crankResults(results);
        $scope.$digest();
        expect($scope.timeline.itemsData.length).to.be(0);
      });
    });
  });
});
