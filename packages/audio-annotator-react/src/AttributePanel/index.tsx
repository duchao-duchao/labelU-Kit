import { useEffect, useMemo, useState } from 'react';
import styled, { css } from 'styled-components';
import { AttributeTree, CollapseWrapper, AttributeTreeWrapper, EllipsisText, uid } from '@labelu/components-react';
import type {
  EnumerableAttribute,
  GlobalAnnotationType,
  MediaAnnotationInUI,
  TagAnnotationEntity,
  TextAnnotationEntity,
  TextAttribute,
} from '@labelu/interface';

import { ReactComponent as DeleteIcon } from '@/assets/icons/delete.svg';
import { useTool } from '@/context/tool.context';
import type { GlobalAnnotation } from '@/context/annotation.context';
import { useAnnotationCtx } from '@/context/annotation.context';
import { useSample } from '@/context/sample.context';

import AsideAttributeItem, { AttributeAction, Header } from './AsideAttributeItem';

const Wrapper = styled.div<{ collapsed: boolean }>`
  height: calc(100vh - var(--offset-top));
  overflow: auto;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;

  ${({ collapsed }) => (collapsed ? 'width: 0;' : 'width: 280px;')}
`;

const AttributeHeaderItem = styled.div<{ active: boolean }>`
  height: 100%;
  display: flex;
  padding: 0 0.5rem;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-bottom: 2px solid transparent;

  ${({ active }) =>
    active &&
    css`
      color: var(--color-primary);
      border-bottom: 2px solid var(--color-primary);
    `}

  &:hover {
    color: var(--color-primary);
  }

  .attribute__status {
    font-size: 12px;
    color: #999;
  }
`;

const TabHeader = styled.div`
  display: flex;
  flex-shrink: 0;
  width: 100%;
  align-items: center;
  justify-content: space-around;
  height: 68px;
  border-bottom: #e5e5e5 1px solid;
`;

const AsideWrapper = styled.div``;

const Content = styled.div<{ activeKey: HeaderType }>`
  padding: 1rem 0;
  flex: 1 auto;
  min-height: 0;
  overflow: auto;

  & > ${AttributeTreeWrapper} {
    display: ${({ activeKey }) => (activeKey === 'global' ? 'block' : 'none')};
  }

  & > ${CollapseWrapper as any} {
    display: ${({ activeKey }) => (activeKey === 'label' ? 'block' : 'none')};
  }
`;

const Footer = styled.div`
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 14px;
  border-top: #e5e5e5 1px solid;
  cursor: pointer;

  &:hover {
    color: red;
  }
`;

type HeaderType = 'global' | 'label';

export function AttributePanel() {
  const { config, labelMapping, preLabelMapping } = useTool();
  const { currentSample } = useSample();
  const {
    annotationsWithGlobal,
    allAnnotationsMapping,
    selectedAnnotation,
    preAnnotationsWithGlobal,
    onAnnotationsChange,
    onGlobalAnnotationClear,
    onMediaAnnotationClear,
  } = useAnnotationCtx();
  const [collapsed, setCollapsed] = useState<boolean>(false);

  const {
    globalAnnotations,
    globalAnnotationsWithPreAnnotation,
    mediaAnnotations,
    preMediaAnnotationGroup,
    mediaAnnotationGroup,
    defaultActiveKeys,
  } = useMemo(() => {
    const mediaAnnotationGroupByLabel = new Map<string, MediaAnnotationInUI[]>();
    const _mediaAnnotations = [...(annotationsWithGlobal?.segment ?? []), ...(annotationsWithGlobal?.frame ?? [])];
    const _globalAnnotations = [...(annotationsWithGlobal?.tag ?? []), ...(annotationsWithGlobal?.text ?? [])];
    const _globalAnnotationsWithPreAnnotation = [..._globalAnnotations];
    const preMediaAnnotationGroupByLabel = new Map<string, MediaAnnotationInUI[]>();
    const preMediaAnnotations = [
      ...(preAnnotationsWithGlobal?.segment ?? []),
      ...(preAnnotationsWithGlobal?.frame ?? []),
    ] as MediaAnnotationInUI[];

    if (!_globalAnnotations.length) {
      [preAnnotationsWithGlobal?.tag, preAnnotationsWithGlobal?.text].forEach((values) => {
        if (values) {
          _globalAnnotationsWithPreAnnotation.push(...(values as GlobalAnnotation[]));
        }
      });
    }

    for (const item of _mediaAnnotations) {
      if (!mediaAnnotationGroupByLabel.has(item.label)) {
        mediaAnnotationGroupByLabel.set(item.label, []);
      }

      mediaAnnotationGroupByLabel?.get(item.label)?.push(item);
    }

    for (const item of preMediaAnnotations) {
      if (!preMediaAnnotationGroupByLabel.has(item.label)) {
        preMediaAnnotationGroupByLabel.set(item.label, []);
      }

      preMediaAnnotationGroupByLabel?.get(item.label)?.push(item);
    }

    return {
      globalAnnotations: _globalAnnotations,
      globalAnnotationsWithPreAnnotation: _globalAnnotationsWithPreAnnotation,
      mediaAnnotations: _mediaAnnotations,
      preMediaAnnotationGroup: preMediaAnnotationGroupByLabel,
      mediaAnnotationGroup: mediaAnnotationGroupByLabel,
      defaultActiveKeys: Array.from(mediaAnnotationGroupByLabel.keys()),
    };
  }, [
    annotationsWithGlobal?.segment,
    annotationsWithGlobal?.frame,
    annotationsWithGlobal?.tag,
    annotationsWithGlobal?.text,
    preAnnotationsWithGlobal?.segment,
    preAnnotationsWithGlobal?.frame,
    preAnnotationsWithGlobal?.tag,
    preAnnotationsWithGlobal?.text,
  ]);

  const globals = useMemo(() => {
    const _globals: (TextAttribute | EnumerableAttribute)[] = [];

    if (config?.tag) {
      _globals.push(...config.tag);
    }

    if (config?.text) {
      _globals.push(...config.text);
    }

    // 预标注的文本和分类需要跟用户配置合并且根据其value去重
    if (!annotationsWithGlobal?.tag?.length) {
      Object.values(preLabelMapping?.tag ?? {})?.forEach((item) => {
        if (!_globals.some((innerItem) => innerItem.value === item.value)) {
          _globals.push({ ...item, disabled: true } as EnumerableAttribute);
        }
      });
    }

    if (!annotationsWithGlobal?.text?.length) {
      Object.values(preLabelMapping?.text ?? {})?.forEach((item) => {
        if (!_globals.some((innerItem) => innerItem.value === item.value)) {
          _globals.push({ ...item, disabled: true } as TextAttribute);
        }
      });
    }

    return _globals;
  }, [
    annotationsWithGlobal?.tag?.length,
    annotationsWithGlobal?.text?.length,
    config?.tag,
    config?.text,
    preLabelMapping?.tag,
    preLabelMapping?.text,
  ]);

  const titles = useMemo(() => {
    const _titles = [];
    // 将文本描述和标签分类合并成全局配置
    if (config?.tag || config?.text || preLabelMapping.tag || preLabelMapping.text) {
      let isCompleted = false;

      const globalAnnotationMapping = globalAnnotations.reduce((acc, item) => {
        const key = Object.keys(item.value)[0];
        acc[key] = item;
        return acc;
      }, {} as Record<string, TextAnnotationEntity | TagAnnotationEntity>);

      /** 如果所有的文本描述都是必填的，那么只要有一个不存在，那么就是未完成  */
      isCompleted = [...(config?.text ?? []), ...(config?.tag ?? [])]
        .filter((item) => item.required)
        .every((item) => globalAnnotationMapping[item.value]?.value?.[item.value]);

      _titles.push({
        title: '全局',
        key: 'global' as const,
        subtitle: isCompleted ? '已完成' : '未完成',
      });
    }

    if (config?.segment || config?.frame) {
      const flatPreMediaAnnotations = Array.from(preMediaAnnotationGroup.values()).reduce((acc, item) => {
        acc.push(...item);
        return acc;
      }, []);

      _titles.push({
        title: '标记',
        key: 'label' as const,
        subtitle: `${mediaAnnotations.length || flatPreMediaAnnotations.length}条`,
      });
    }

    return _titles;
  }, [
    config?.tag,
    config?.text,
    config?.segment,
    config?.frame,
    preLabelMapping.tag,
    preLabelMapping.text,
    globalAnnotations,
    mediaAnnotations.length,
    preMediaAnnotationGroup,
  ]);
  const [activeKey, setActiveKey] = useState<HeaderType>(globals.length === 0 ? 'label' : 'global');

  useEffect(() => {
    const handleCollapse = () => {
      setCollapsed((prev) => !prev);
    };

    document.addEventListener('attribute-collapse', handleCollapse as EventListener);

    return () => {
      document.removeEventListener('attribute-collapse', handleCollapse as EventListener);
    };
  }, []);

  const handleOnChange = (
    _changedValues: any,
    values: Record<GlobalAnnotationType, Record<string, TextAnnotationEntity | TagAnnotationEntity>>,
  ) => {
    const newAnnotations = [];
    const existAnnotations: (TextAnnotationEntity | TagAnnotationEntity)[] = [];

    for (const type of Object.keys(values)) {
      const annotationType = type as GlobalAnnotationType;
      const innerValues = values[type as GlobalAnnotationType];
      for (const field of Object.keys(innerValues)) {
        const item = innerValues[field];
        const configItems = config?.[annotationType] ?? [];

        // 不在用户配置的全局标签不保存
        // @ts-ignore
        if (!configItems.find((_item) => _item.value === field)) {
          continue;
        }

        if (item.id && item.id in allAnnotationsMapping) {
          existAnnotations.push(item);
        } else {
          newAnnotations.push({
            id: item.id || uid(),
            type: annotationType,
            value: item.value,
          });
        }
      }
    }

    const _annotations =
      mediaAnnotations.map((item) => {
        const existIndex = existAnnotations.findIndex((innerItem) => innerItem.id === item.id);
        if (existIndex >= 0) {
          return existAnnotations[existIndex];
        }

        return item;
      }) ?? [];
    onAnnotationsChange([..._annotations, ...newAnnotations]);
  };

  const handleClear = () => {
    if (!currentSample) {
      return;
    }

    if (activeKey === 'global') {
      onGlobalAnnotationClear();
    } else {
      onMediaAnnotationClear();
    }
  };

  const collapseItems = useMemo(
    () =>
      Array.from(mediaAnnotationGroup.size > 0 ? mediaAnnotationGroup : preMediaAnnotationGroup).map(
        ([label, _annotations]) => {
          const found = labelMapping[_annotations[0].type]?.[label] ?? preLabelMapping?.[_annotations[0].type]?.[label];
          const labelText = found ? found?.key ?? '无标签' : '无标签';

          return {
            label: (
              <Header>
                <EllipsisText maxWidth={180} title={labelText}>
                  <div>{labelText}</div>
                </EllipsisText>

                <AttributeAction annotations={_annotations} showEdit={false} />
              </Header>
            ),
            key: label,
            children: (
              <AsideWrapper>
                {_annotations.map((item) => {
                  const labelOfAnnotation = labelMapping[item.type]?.[label] ?? preLabelMapping?.[item.type]?.[label];

                  return (
                    <AsideAttributeItem
                      key={item.id}
                      active={item.id === selectedAnnotation?.id}
                      order={item.order}
                      annotation={item}
                      labelText={labelOfAnnotation?.key ?? '无标签'}
                      color={labelOfAnnotation?.color ?? '#999'}
                    />
                  );
                })}
              </AsideWrapper>
            ),
          };
        },
      ),
    [mediaAnnotationGroup, preMediaAnnotationGroup, labelMapping, preLabelMapping, selectedAnnotation?.id],
  );

  return (
    <Wrapper collapsed={collapsed}>
      <TabHeader className="attribute-header">
        {titles.map((item) => {
          return (
            <AttributeHeaderItem
              onClick={() => setActiveKey(item.key)}
              active={item.key === activeKey}
              key={item.key}
              className="attribute-header__item"
            >
              <div>{item.title}</div>
              <div className="attribute__status">{item.subtitle}</div>
            </AttributeHeaderItem>
          );
        })}
      </TabHeader>
      <Content activeKey={activeKey}>
        <CollapseWrapper defaultActiveKey={defaultActiveKeys} items={collapseItems} />
        <AttributeTree data={globalAnnotationsWithPreAnnotation} config={globals} onChange={handleOnChange} />
      </Content>
      <Footer onClick={handleClear}>
        <DeleteIcon />
        &nbsp; 清空
      </Footer>
    </Wrapper>
  );
}
