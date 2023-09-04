import { EToolName, TOOL_NAME, EVideoToolName } from '@label-u/annotation';
import type { FormProps, MenuProps, TabsProps } from 'antd';
import { Empty, Popconfirm, Button, Dropdown, Form, Tabs } from 'antd';
import React, { useContext, useEffect, useCallback, useMemo, useState } from 'react';
import _, { cloneDeep, find } from 'lodash-es';
import { PlusOutlined } from '@ant-design/icons';
import { useSelector } from 'react-redux';

import { MediaType, TaskStatus } from '@/services/types';
import FancyForm from '@/components/FancyForm';
import FancyInput, { add } from '@/components/FancyInput';
import type { RootState } from '@/store';

import { TaskCreationContext } from '../../../taskCreation.context';
import { FancyAttributeList } from './customFancy/ListAttribute.fancy';
import { FancyCategoryAttribute } from './customFancy/CategoryAttribute.fancy';
import styles from './index.module.scss';
import lineTemplate from './templates/line.template';
import rectTemplate from './templates/rect.template';
import polygonTemplate from './templates/polygon.template';
import pointTemplate from './templates/point.template';
import tagTemplate from './templates/tag.template';
import textTemplate from './templates/text.template';
import videoSegmentTemplate from './templates/segment.template';
import videoFrameTemplate from './templates/frame.template';

// 注册fancyInput自定义输入组件
add('list-attribute', FancyAttributeList);
add('category-attribute', FancyCategoryAttribute);

const globalTools = [EToolName.Tag, EToolName.Text];
const graphicTools = [EToolName.Rect, EToolName.Point, EToolName.Polygon, EToolName.Line, ...globalTools];
const videoAnnotationTools = [EVideoToolName.VideoSegmentTool, EVideoToolName.VideoFrameTool, ...globalTools];

const toolMapping = {
  [MediaType.IMAGE]: graphicTools.map((item) => {
    return {
      label: TOOL_NAME[item],
      value: item,
    };
  }),
  [MediaType.VIDEO]: videoAnnotationTools.map((item) => {
    return {
      label: TOOL_NAME[item],
      value: item,
    };
  }),
};

const templateMapping: Record<string, any> = {
  [EToolName.Line]: lineTemplate,
  [EToolName.Rect]: rectTemplate,
  [EToolName.Polygon]: polygonTemplate,
  [EToolName.Point]: pointTemplate,
  [EToolName.Tag]: tagTemplate,
  [EToolName.Text]: textTemplate,
  [EVideoToolName.VideoSegmentTool]: videoSegmentTemplate,
  [EVideoToolName.VideoFrameTool]: videoFrameTemplate,
};

const FormConfig = () => {
  const { annotationFormInstance, onAnnotationFormChange, task } = useContext(TaskCreationContext);
  const [activeTool, setActiveTool] = useState<string | undefined>();
  const [selectedTools, setSelectedTools] = useState<any[]>([]);
  const [selectedGlobalTools, setSelectedGlobalTools] = useState<string[]>([]);
  const [activeGlobalTool, setActiveGlobalTool] = useState<string | undefined>();
  const [hasAttributes, setHasAttributes] = useState(false);

  const config = useSelector((state: RootState) => state.task.config);
  const taskStatus = useSelector((state: RootState) => state.task.item.status);
  const taskDoneAmount = useSelector((state: RootState) => state.task.item.stats?.done);
  const { tools } = config || {};

  // 进行中和已完成的任务不允许删除工具
  const deletable = useMemo(() => {
    const isNewTool = !find(tools, { tool: activeTool });

    if (isNewTool) {
      return true;
    }

    if ([TaskStatus.INPROGRESS, TaskStatus.FINISHED].includes(taskStatus as TaskStatus) || taskDoneAmount) {
      return false;
    }

    return true;
  }, [tools, activeTool, taskStatus, taskDoneAmount]);

  useEffect(() => {
    setSelectedTools(_.chain(tools).compact().map('tool').value());
    setActiveTool((tools || [])[0]?.tool);
    setHasAttributes(config?.commonAttributeConfigurable ?? false);
  }, [config, tools]);

  // ======================== 以下为新增代码 ========================
  const handleToolItemClick: MenuProps['onClick'] = async ({ key }) => {
    if (globalTools.includes(key as EToolName)) {
      setSelectedGlobalTools((pre) => [...pre, key]);
      setActiveGlobalTool(key);
    } else {
      setActiveTool(key);
      setSelectedTools((pre) => [...pre, key]);
    }

    if (typeof onAnnotationFormChange === 'function') {
      setTimeout(onAnnotationFormChange);
    }
  };

  const handleRemoveTool = useCallback(
    (toolName: EToolName) => () => {
      if (globalTools.includes(toolName)) {
        const newTools = selectedGlobalTools.filter((item) => item !== toolName);
        setSelectedGlobalTools(newTools);
        setActiveGlobalTool(newTools[0]);
      } else {
        const newTools = selectedTools.filter((item) => item !== toolName);
        setSelectedTools(newTools);
        setActiveTool(newTools[0]);
      }

      // 因为antd的form的特殊性，删除数组元素时，需要手动调用setFieldsValue
      const prevValues = cloneDeep(annotationFormInstance.getFieldsValue());

      setTimeout(() => {
        annotationFormInstance.setFieldsValue({
          ...prevValues,
          tools: prevValues.tools.filter((item: any) => item.tool !== toolName),
        });

        if (typeof onAnnotationFormChange === 'function') {
          setTimeout(onAnnotationFormChange);
        }
      });
    },
    [annotationFormInstance, onAnnotationFormChange, selectedGlobalTools, selectedTools],
  );

  const toolsMenu: MenuProps['items'] = useMemo(() => {
    const toolOptions = toolMapping[task.media_type!];

    return _.chain(toolOptions)
      .filter((item) => !selectedTools.includes(item.value) && !selectedGlobalTools.includes(item.value))
      .map(({ value, label }) => ({
        key: value,
        label: <span>{label}</span>,
      }))
      .value();
  }, [selectedGlobalTools, selectedTools, task.media_type]);

  const tabItems: TabsProps['items'] = useMemo(() => {
    return _.map(selectedTools, (tool, index) => {
      const fancyFormTemplate = templateMapping[tool] || null;

      return {
        key: tool,
        label: TOOL_NAME[tool],
        forceRender: true,
        children: (
          <div className={styles.innerForm}>
            <div style={{ display: deletable ? 'flex' : 'none', justifyContent: 'flex-end' }}>
              <Popconfirm title="确定删除此工具吗？" onConfirm={handleRemoveTool(tool as EToolName)}>
                <Button type="link" danger style={{ marginBottom: '0.5rem' }}>
                  删除工具
                </Button>
              </Popconfirm>
            </div>
            <FancyForm template={fancyFormTemplate} name={['tools', index]} />
          </div>
        ),
      };
    });
  }, [deletable, handleRemoveTool, selectedTools]);

  const tabItemsOfGlobalTools: TabsProps['items'] = useMemo(() => {
    return _.map(selectedGlobalTools, (tool, index) => {
      const fancyFormTemplate = templateMapping[tool] || null;

      return {
        key: tool,
        label: TOOL_NAME[tool],
        forceRender: true,
        children: (
          <div className={styles.innerForm}>
            <div style={{ display: deletable ? 'flex' : 'none', justifyContent: 'flex-end' }}>
              <Popconfirm title="确定删除此工具吗？" onConfirm={handleRemoveTool(tool as EToolName)}>
                <Button type="link" danger style={{ marginBottom: '0.5rem' }}>
                  删除工具
                </Button>
              </Popconfirm>
            </div>
            <FancyForm template={fancyFormTemplate} name={['tools', index]} />
          </div>
        ),
      };
    });
  }, [deletable, handleRemoveTool, selectedGlobalTools]);

  // TODO: 增加表单数据类型
  const handleFormValuesChange: FormProps['onValuesChange'] = useCallback(
    (changedValue: any) => {
      if ('commonAttributeConfigurable' in changedValue) {
        if (!changedValue.commonAttributeConfigurable) {
          annotationFormInstance.setFieldValue('attributes', []);
        }
        setHasAttributes(changedValue.commonAttributeConfigurable);
      }
    },
    [annotationFormInstance],
  );

  // ========================= end ==============================

  return (
    <Form
      form={annotationFormInstance}
      labelCol={{ span: 4 }}
      wrapperCol={{ span: 20 }}
      colon={false}
      className={styles.formConfig}
      initialValues={config}
      onValuesChange={handleFormValuesChange}
      validateTrigger="onBlur"
    >
      <Form.Item label="标注工具">
        <Dropdown menu={{ items: toolsMenu, onClick: handleToolItemClick }} placement="bottomLeft" trigger={['click']}>
          <Button type="primary" ghost icon={<PlusOutlined />}>
            新增工具
          </Button>
        </Dropdown>
      </Form.Item>
      <Form.Item wrapperCol={{ offset: 4 }}>
        {selectedGlobalTools.length > 0 ? (
          <div className="formTabBox">
            <Tabs
              type="card"
              size="small"
              activeKey={activeGlobalTool}
              destroyInactiveTabPane={false}
              onChange={(tabKey) => {
                setActiveGlobalTool(tabKey);
              }}
              items={tabItemsOfGlobalTools}
            />
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请选择工具" />
        )}
      </Form.Item>

      <Form.Item
        label={<span className="formTitle">通用标签</span>}
        name="commonAttributeConfigurable"
        tooltip="已经配置的所有标注工具均可以使用通用标签"
        hidden={!graphicTools.includes(activeTool as EToolName)}
      >
        <FancyInput type="boolean" />
      </Form.Item>
      <Form.Item
        wrapperCol={{ offset: 4 }}
        className={styles.attributes}
        hidden={!hasAttributes || !graphicTools.includes(activeTool as EToolName)}
      >
        <div className={styles.attributesBox}>
          <Form.Item name="attributes">
            <FancyInput type="list-attribute" fullField={['attributes']} />
          </Form.Item>
        </div>
      </Form.Item>

      <Form.Item
        label="画布外标注"
        name="drawOutsideTarget"
        tooltip="开启后可以在媒体文件画布范围外进行标注"
        hidden={!graphicTools.includes(activeTool as EToolName)}
      >
        <FancyInput type="boolean" />
      </Form.Item>
      <Form.Item wrapperCol={{ offset: 4 }}>
        {selectedTools.length > 0 ? (
          <div className="formTabBox">
            <Tabs
              type="card"
              size="small"
              activeKey={activeTool}
              destroyInactiveTabPane={false}
              onChange={(tabKey) => {
                setActiveTool(tabKey);
              }}
              items={tabItems}
            />
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请选择工具" />
        )}
      </Form.Item>
    </Form>
  );
};

export default React.memo(FormConfig);
