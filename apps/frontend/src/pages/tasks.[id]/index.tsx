import React, { useLayoutEffect, useMemo, useState } from 'react';
import { Link, useParams, useRevalidator, useRouteLoaderData, useSearchParams } from 'react-router-dom';
import type { ColumnsType, TableProps } from 'antd/es/table';
import { Table, Pagination, Button, Popconfirm, Tag, Tooltip } from 'antd';
import { VideoCard, FlexLayout } from '@labelu/components-react';
import _ from 'lodash-es';
import formatter from '@labelu/formatter';
import styled from 'styled-components';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { useTranslation } from '@labelu/i18n';

import type { PreAnnotationFileResponse, SampleResponse } from '@/api/types';
import { MediaType, TaskStatus } from '@/api/types';
import ExportPortal from '@/components/ExportPortal';
import type { TaskLoaderResult } from '@/loaders/task.loader';
import BlockContainer from '@/layouts/BlockContainer';
import { downloadFromUrl, getThumbnailUrl } from '@/utils';
import { deletePreAnnotationFile } from '@/api/services/preAnnotations';
import { deleteSamples } from '@/api/services/samples';

import type { TaskStatusProps } from './components/Statistical';
import Statistical, { TaskStatus as TaskStatusComponent } from './components/Statistical';
import GoToEditTask from './components/GoToEditTask';

const HeaderWrapper = styled(FlexLayout.Header)`
  background-color: #fff;
  height: 3.5rem;
`;

const Samples = () => {
  const routerData = useRouteLoaderData('task') as TaskLoaderResult;
  const samples = _.get(routerData, 'samples.data');
  const revalidator = useRevalidator();
  const preAnnotations = _.get(routerData, 'preAnnotations.data') as any;
  const task = _.get(routerData, 'task');
  const metaData = routerData?.samples?.meta_data;
  const routeParams = useParams();
  const taskId = +routeParams.taskId!;
  const { t, i18n } = useTranslation();

  // 查询参数
  const [searchParams, setSearchParams] = useSearchParams(
    new URLSearchParams({
      // 默认按照最后更新时间倒序
      pageNo: '1',
      pageSize: '10',
    }),
  );

  const sampleNamesWithPreAnnotation = useMemo(() => {
    return _.chain(preAnnotations).map('sample_names').flatten().value();
  }, [preAnnotations]);

  const taskStatus = _.get(task, 'status');
  const isTaskReadyToAnnotate =
    ![TaskStatus.DRAFT, TaskStatus.IMPORTED].includes(taskStatus!) &&
    task?.config &&
    Object.keys(task?.config).length > 0;
  const [enterRowId, setEnterRowId] = useState<any>(undefined);
  const [selectedSampleIds, setSelectedSampleIds] = useState<any>([]);

  const handleDeleteJsonl = async (id: number) => {
    await deletePreAnnotationFile({
      task_id: taskId,
      file_id: id,
    });

    revalidator.revalidate();
  };

  const handleDeleteSample = async (ids: number[]) => {
    await deleteSamples({ task_id: taskId }, { sample_ids: ids });
    revalidator.revalidate();
  };

  const columns: ColumnsType<SampleResponse | PreAnnotationFileResponse> = [
    {
      title: t('innerId'),
      dataIndex: 'inner_id',
      key: 'inner_id',
      align: 'left',
      sorter: true,
    },
    {
      title: t('filename'),
      dataIndex: ['file', 'filename'],
      key: 'filename',
      align: 'left',
      render: (filename, record) => {
        const _filename = (record as SampleResponse).file?.filename ?? '';

        if ((record as PreAnnotationFileResponse).sample_names) {
          return (
            <span>
              {formatter.format('ellipsis', _.get(record, 'filename'), { maxWidth: 160, type: 'tooltip' })}
              &nbsp;
              <Tag color="processing">{t('preAnnotation')}</Tag>
            </span>
          );
        }
        return formatter.format('ellipsis', _filename, { maxWidth: 160, type: 'tooltip' });
      },
    },
    {
      title: t('dataPreview'),
      dataIndex: 'file',
      key: 'file',
      align: 'left',
      render: (data, record) => {
        if ((record as PreAnnotationFileResponse).sample_names) {
          return '-';
        }

        if (task!.media_type === MediaType.IMAGE) {
          const thumbnailUrl = getThumbnailUrl(data.url!);
          return <img src={thumbnailUrl} style={{ width: '116px', height: '70px' }} />;
        } else if (task!.media_type === MediaType.AUDIO) {
          return <audio src={data?.url} controls />;
        } else {
          return <VideoCard size={{ width: 116, height: 70 }} src={data?.url} showPlayIcon showDuration />;
        }
      },
    },
    {
      title: (
        <>
          {t('preAnnotation')} &nbsp;
          <Tooltip
            title={
              <>
                {t('preAnnotationDescription')}{' '}
                <a
                  href={`https://opendatalab.github.io/labelU/${
                    i18n.language.startsWith('en') ? 'en/' : ''
                  }schema/pre-annotation/json`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('example')}
                </a>
              </>
            }
          >
            <QuestionCircleOutlined />
          </Tooltip>
        </>
      ),
      dataIndex: 'unknown',
      key: 'unknown',
      align: 'left',
      render: (text, record) => {
        const sampleNames = _.get(record, 'sample_names');
        if (sampleNames) {
          return '-';
        }

        const sampleName = (record as SampleResponse).file?.filename;
        // sample_name前8为是截取的uuid，截取第9位到最后一位（如果预标注是非labelu生成的，jsonl中的sample name可能不带前缀）
        const realSampleName = record.file?.filename?.substring(9);

        return sampleNamesWithPreAnnotation.includes(realSampleName) ||
          sampleNamesWithPreAnnotation.includes(sampleName)
          ? t('yes')
          : '';
      },
    },
    {
      title: t('annotationState'),
      dataIndex: 'state',
      key: 'state',
      align: 'left',
      render: (text, record) => {
        if (record.file?.filename?.endsWith('.jsonl')) {
          return '-';
        }

        if (!isTaskReadyToAnnotate) {
          return '-';
        }

        return <TaskStatusComponent status={_.lowerCase(text) as TaskStatusProps['status']} />;
      },
      sorter: true,
    },
    {
      title: t('annotationCount'),
      dataIndex: 'annotated_count',
      key: 'annotated_count',
      align: 'left',
      render: (_unused, record) => {
        const sampleNames = _.get(record, 'sample_names');

        if (sampleNames) {
          return '';
        }

        let result = 0;
        const resultJson = record?.data?.result ? JSON.parse(record?.data?.result) : {};
        for (const key in resultJson) {
          if (key.indexOf('Tool') > -1 && key !== 'textTool' && key !== 'tagTool') {
            const tool = resultJson[key];
            if (!tool.result) {
              let _temp = 0;
              if (tool.length) {
                _temp = tool.length;
              }
              result = result + _temp;
            } else {
              result = result + tool.result.length;
            }
          }
        }
        return result;
      },
      sorter: true,
      width: 80,
    },
    {
      title: t('createdBy'),
      dataIndex: 'created_by',
      key: 'created_by',
      align: 'left',
      render: (created_by, record) => {
        const sampleNames = _.get(record, 'sample_names');

        if (sampleNames) {
          return '-';
        }

        if (!isTaskReadyToAnnotate) {
          return '-';
        }

        return created_by.username;
      },
    },
    {
      title: t('updatedAt'),
      dataIndex: 'updated_at',
      key: 'updated_at',
      align: 'left',
      sorter: true,
      render: (updated_at, record) => {
        const sampleNames = _.get(record, 'sample_names');

        if (sampleNames) {
          return '-';
        }

        if (!isTaskReadyToAnnotate) {
          return '';
        }

        return formatter.format('dateTime', new Date(updated_at), { style: 'YYYY-MM-DD HH:mm' });
      },
    },
    {
      title: '',
      dataIndex: 'option',
      key: 'option',
      width: 140,
      align: 'center',
      fixed: 'right',
      render: (x, record) => {
        const sampleNames = _.get(record, 'sample_names');

        if (record.id !== enterRowId) {
          return '';
        }

        if (sampleNames) {
          return (
            <FlexLayout items="center">
              <Button type="link" onClick={() => downloadFromUrl(record.url, record?.filename)}>
                {t('download')}
              </Button>
              <Popconfirm title={t('deleteConfirm')} onConfirm={() => handleDeleteJsonl(record.id!)}>
                <Button type="link" danger>
                  {t('delete')}
                </Button>
              </Popconfirm>
            </FlexLayout>
          );
        }

        return (
          <FlexLayout items="center" gap="0.5rem">
            {isTaskReadyToAnnotate && (
              <Link to={`/tasks/${taskId}/samples/${record.id}`}>
                <Button type="link">{t('startAnnotate')}</Button>
              </Link>
            )}
            <Popconfirm title={t('deleteConfirm')} onConfirm={() => handleDeleteSample([record.id!])}>
              <Button type="link" danger>
                {t('delete')}
              </Button>
            </Popconfirm>
          </FlexLayout>
        );
      },
    },
  ];

  const rowSelection: TableProps<SampleResponse>['rowSelection'] = {
    columnWidth: 58,
    onChange: (selectedKeys) => {
      setSelectedSampleIds(selectedKeys);
    },
  };

  const handleTableChange: TableProps<SampleResponse>['onChange'] = (pagination, filters, sorter) => {
    if (!_.isEmpty(pagination)) {
      searchParams.set('pageNo', `${pagination.current}`);
      searchParams.set('pageSize', `${pagination.pageSize}`);
    }

    if (sorter) {
      let sortValue = '';
      // @ts-ignore
      switch (sorter.order) {
        case 'ascend':
          sortValue = 'asc';
          break;
        case 'descend':
          sortValue = 'desc';
          break;
        case undefined:
          sortValue = 'desc';
          break;
      }
      searchParams.set('sort', `${_.get(sorter, 'field')}:${sortValue}`);
    } else {
      searchParams.delete('sort');
    }

    setSearchParams(searchParams);
  };
  const handlePaginationChange = (page: number, pageSize: number) => {
    searchParams.set('pageNo', `${page}`);
    searchParams.set('pageSize', `${pageSize}`);
    setSearchParams(searchParams);
  };

  const onMouseEnterRow = (rowId: any) => {
    setEnterRowId(rowId);
  };
  const onRow = (record: any) => {
    return {
      onMouseLeave: () => setEnterRowId(undefined),
      onMouseOver: () => {
        onMouseEnterRow(record.id);
      },
    };
  };

  useLayoutEffect(() => {
    if (task?.media_type !== MediaType.AUDIO) {
      return;
    }

    const handleOnPlay = (e: Event) => {
      const audios = document.getElementsByTagName('audio');
      // 使当前只有一条音频在播放
      for (let i = 0, len = audios.length; i < len; i++) {
        if (audios[i] !== e.target) {
          (audios[i] as HTMLAudioElement).pause();
        }
      }
    };

    document.addEventListener('play', handleOnPlay, true);

    return () => {
      document.removeEventListener('play', handleOnPlay, true);
    };
  }, [task?.media_type]);

  const data = useMemo(() => {
    return [...(preAnnotations ?? []), ...(samples ?? [])];
  }, [preAnnotations, samples]);

  return (
    <FlexLayout flex="column" full gap="2rem">
      <HeaderWrapper flex items="center">
        <FlexLayout.Content full>
          <BlockContainer>
            {isTaskReadyToAnnotate ? <Statistical /> : <GoToEditTask taskStatus={taskStatus} />}
          </BlockContainer>
        </FlexLayout.Content>
      </HeaderWrapper>

      <FlexLayout.Content scroll>
        <FlexLayout justify="space-between" flex="column" gap="1rem" padding="0 1.5rem 1.5rem">
          <Table
            columns={columns}
            dataSource={data}
            pagination={false}
            rowKey={(record) => record.id!}
            rowSelection={rowSelection}
            onRow={onRow}
            onChange={handleTableChange}
          />
          <FlexLayout justify="space-between">
            <ExportPortal
              taskId={+taskId!}
              sampleIds={selectedSampleIds}
              mediaType={task!.media_type!}
              tools={task?.config?.tools}
            >
              <Button type="link" disabled={selectedSampleIds.length === 0}>
                {t('batchExport')}
              </Button>
            </ExportPortal>
            <Pagination
              current={parseInt(searchParams.get('pageNo') || '1')}
              pageSize={parseInt(searchParams.get('pageSize') || '10')}
              total={metaData?.total}
              showSizeChanger
              showQuickJumper
              onChange={handlePaginationChange}
            />
          </FlexLayout>
        </FlexLayout>
      </FlexLayout.Content>
    </FlexLayout>
  );
};

export default Samples;
