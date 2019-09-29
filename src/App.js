import React, { useState, useEffect, useRef } from 'react';
import { DefaultButton, IconButton, Callout, Stack, ProgressIndicator, Pivot, PivotItem, CommandBar, Toggle, setFocusVisibility } from 'office-ui-fabric-react';
import DataTable from './components/table';
import PreferencePanel from './components/preference';
import FieldPanel from './components/fieldConfig';
import BaseChart from './demo/vegaBase';
import Papa from 'papaparse';
import './App.css';

const { specificationWithFieldsAnalysisResult, dropNull } = require('./build/bundle.js');
const pivotList = [
  {
    title: 'DataSource',
    itemKey: 'pivot-' + 1
  },
  {
    title: 'Explore',
    itemKey: 'pivot-' + 2
  }
]
function App() {
  const [page, setPage] = useState(0);
  const [showInsightBoard, setShowInsightBoard] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tableData, setTableData] = useState([]);
  const [dataSource, setDataSource] = useState([])

  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [showFieldConfig, setShowFieldConfig] = useState(false);
  const [showDataConfig, setShowDataConfig] = useState(false);
  const [visualConfig, setVisualConfig] = useState({
    aggregator: 'sum',
    defaultAggregated: true,
    defaultStack: true
  })
  const [cleanData, setCleanData] = useState([]);
  const [dimScores, setDimScores] = useState([]);
  const [dataView, setDataView] = useState({
    schema: {
      position: [],
      color: [],
      opacity: [],
      geomType: ['interval']
    },
    fieldFeatures: [],
    aggData: [],
    dimensions: [],
    measures: []
  });
  const [fields, setFields] = useState([]);
  const [result, setResult] = useState([]);
  const [currentPivotKey, setCurrenyPivotKey] = useState(pivotList[0].itemKey);
  const dataSetting = useRef();
  const fileEle = useRef();
  // async function fetchDataSource () {
  //   const res = await fetch('//localhost:8000/api/data/airbnb');
  //   const result = await res.json();
  //   if (result.success) {
  //     setDataset(result.data);
  //   }
  // }
  async function fieldsAnalysisService (cleanData, dimensions, measures) {
    const res = await fetch('//localhost:8000/api/service/fieldsAnalysis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dataSource: cleanData,
        dimensions,
        measures
      })
    });
    const result = await res.json();
    if (result.success) {
      const { dimScores, aggData } = result.data;
      const newDimensions = dimScores.map(dim => dim[0]).filter(dim => !measures.includes(dim));
      setCleanData(aggData);
      setDimScores(dimScores);
      await getInsightViewsService(aggData, newDimensions, measures);
    }
  }
  async function getInsightViewsService (aggData, newDimensions, measures) {
    const res = await fetch('//localhost:8000/api/service/getInsightViews', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dataSource: aggData,
        dimensions: newDimensions,
        measures
      })
    });
    const result = await res.json();
    if (result.success) {
      const views = result.data;
      setResult(views);
    }
  }
  async function extractInsights (dataSource, fields) {
    const dimensions = fields.filter(field => field.type === 'dimension').map(field => field.name)
    const measures = fields.filter(field => field.type === 'measure').map(field => field.name)
    const cleanData = dropNull(dataSource, dimensions, measures);
    setLoading(true);
    await fieldsAnalysisService(cleanData, dimensions, measures);
    setLoading(false);
  } 
  // useEffect(() => {
  //   fetchDataSource();
  // }, [])

  useEffect(() => {
    if (charts.length > 0) {
      gotoPage(0)
    }
  }, [cleanData, result]);


  let charts = [];
  for (let report of result) {
    const dimList = report.detail[0];
    for (let meaList of report.groups) {
      charts.push({
        dimList,
        meaList
      })
    }
  }
  const gotoPage = (pageNo) => {
    // let pageNo = (page - 1 + charts.length) % charts.length;
    let fieldsOfView = charts[pageNo].dimList.concat(charts[pageNo].meaList)
    let scoreOfDimensionSubset = dimScores.filter(dim => fieldsOfView.includes(dim[0]));
    let {schema, aggData} = specificationWithFieldsAnalysisResult(scoreOfDimensionSubset, cleanData, charts[pageNo].meaList);
    setPage(pageNo);
    setDataView({
      schema,
      aggData,
      fieldFeatures: scoreOfDimensionSubset.map(item => item[3]),
      dimensions: charts[pageNo].dimList,
      measures: charts[pageNo].meaList
    })
  }
  // ChevronRight
  const commandBarList = [
    {
      key: 'upload',
      name: 'Upload',
      iconProps: { iconName: 'Upload' },
      onClick: () => {
        if (fileEle.current) {
          fileEle.current.click();
        }
      }
    }
  ]
  function readFile (file) {
    return new Promise((resolve, reject) => {
      let reader = new FileReader()
      reader.readAsText(file)
      reader.onload = (ev) => {
        resolve(ev.target.result)
      }
      reader.onerror = reject
    })
  }
  const fileUploadHanlder = () => {
    const file = fileEle.current.files[0];
    console.log(file.type)
    if (file.type === 'text/csv') {
      Papa.parse(file, {
        complete (results, file) {
          let data = results.data;
          let tmpFields = data[0].map((fieldName, index) => {
            return {
              name: fieldName,
              type: data.slice(1).every(row => {
                return !isNaN(row[index]) || row[index] === undefined;
              }) ? 'measure' : 'dimension'
            }
          });
          setFields(tmpFields);
          setTableData(data.slice(1).map(row => {
            let record = {};
            tmpFields.forEach((field, index) => {
              record[field.name] = row[index]
            })
            return record
          }))
        }
      })
    } else if (file.type === 'application/json') {
        readFile(file).then(result => {
          let data = JSON.parse(result);
          let tmpFields = Object.keys(data[0]).map(fieldName => {
            return {
              name: fieldName,
              type: data.every(row => {
                return !isNaN(row[fieldName]) || row[fieldName] === undefined;
              }) ? 'measure' : 'dimension'
            }
          });
          setFields(tmpFields);
          setTableData(data);
        })
    }
  }
  function transNumber(num) {
    if (isNaN(num)) {
      return null
    }
    return Number(num)
  }
  useEffect(() => {
    console.log(tableData, fields)
    let ds = tableData.map(row => {
      let record = {}
      fields.forEach(field => {
        record[field.name] = field.type === 'dimension' ? row[field.name] : transNumber(row[field.name])
      })
      return record
    })
    setDataSource(ds);
  }, [fields, tableData])
  
  return (
    <div>
      <div className="header-bar" >
        <Pivot selectedKey={currentPivotKey} onLinkClick={(item) => { setCurrenyPivotKey(item.props.itemKey) }} headersOnly={true}>
          {
            pivotList.map(pivot => <PivotItem key={pivot.itemKey} headerText={pivot.title} itemKey={pivot.itemKey} />)
          }
        </Pivot>
      </div>
      {
        currentPivotKey === 'pivot-2' && <div className="content-container">
          <PreferencePanel show={showConfigPanel}
            config={visualConfig}
            onUpdateConfig={(config) => {
              setVisualConfig(config)
              setShowConfigPanel(false);
            }}
            onClose={() => { setShowConfigPanel(false) }} />
          {
            !showInsightBoard ? undefined : <div className="card">
              {
                !loading ? undefined : <ProgressIndicator description="calculating" />
              }
              <h2 style={{marginBottom: 0}}>Visual Insights <IconButton iconProps={{iconName: 'Settings'}} ariaLabel="preference" onClick={() => {setShowConfigPanel(true)}} /></h2>
              <p className="state-description">Page No. {page + 1} of {charts.length}</p>
              <div className="ms-Grid" dir="ltr">
                <div className="ms-Grid-row">
                <div className="ms-Grid-col ms-sm6 ms-md8 ms-lg3" style={{overflow: 'auto'}}>
                  <Stack horizontal tokens={{ childrenGap: 20 }}>
                    <DefaultButton text="Last" onClick={() => { gotoPage((page - 1 + charts.length) % charts.length) }} allowDisabledFocus />
                    <DefaultButton text="Next" onClick={() => { gotoPage((page + 1) % charts.length) }} allowDisabledFocus />
                  </Stack>
                  <h3>Specification</h3>
                  <pre>
                    {JSON.stringify(dataView.schema, null, 2)}
                  </pre>
                </div>
                <div className="ms-Grid-col ms-sm6 ms-md4 ms-lg9" style={{overflow: 'auto'}}>
                  <BaseChart
                    aggregator={visualConfig.aggregator}
                    defaultAggregated={visualConfig.defaultAggregated}
                    defaultStack={visualConfig.defaultStack}
                    dimensions={dataView.dimensions}
                    measures={dataView.measures}
                    dataSource={dataView.aggData}
                    schema={dataView.schema}
                    fieldFeatures={dataView.fieldFeatures} />
                </div>
                </div>
              </div>
            </div>
          }
        </div>
      }
      {
        currentPivotKey === 'pivot-1' && <div className="content-container">
          <FieldPanel fields={fields}
          show={showFieldConfig} onUpdateConfig={(fields) => {
              setFields(fields);
            }}
            onClose={() => {setShowFieldConfig(false)}}
          />
          <div className="card">
            <Stack horizontal>
              <DefaultButton disabled={dataSource.length === 0} iconProps={{iconName: 'Financial'}} text="Extract Insights" onClick={() => {
                setCurrenyPivotKey('pivot-2');
                setShowInsightBoard(true);
                extractInsights(dataSource, fields);
              }} />
              <div ref={dataSetting}>
                <IconButton iconProps={{iconName: 'ExcelDocument'}} ariaLabel="upload data" onClick={() => {setShowDataConfig(true)}} />
                <Callout
                  style={{ maxWidth: 300}}
                  className="vi-callout-callout"
                  role="alertdialog"
                  gapSpace={0}
                  target={dataSetting.current}
                  onDismiss={() => {setShowDataConfig(false)}}
                  setInitialFocus={true}
                  hidden={!showDataConfig}
                >
                  <div className="vi-callout-header">
                  <p className="vi-callout-title">
                    Upload Your own dataset
                  </p>
                </div>
                <div className="vi-callout-inner">
                  <div className="vi-callout-content">
                    <p className="vi-callout-subTex">
                      .csv, .json, .txt are supportted.
                    </p>
                  </div>
                  <div className="vi-callout-actions">
                    <input type="file" ref={fileEle} multiple accept="*" style={{ display: 'none' }} onChange={fileUploadHanlder} />
                    <CommandBar overflowButtonProps={{ name: 'More' }} items={commandBarList} />
                  </div>
                </div>
              </Callout>
              </div>
              <IconButton iconProps={{iconName: 'Settings'}} ariaLabel="field setting" onClick={ () => {setShowFieldConfig(true)} } />
            </Stack>
            <DataTable
              fields={fields}
              dataSource={dataSource} />
          </div>
        </div>
      }
      
    </div>
  );
}

export default App;
