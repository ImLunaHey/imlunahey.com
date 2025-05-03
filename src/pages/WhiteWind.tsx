import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { okaidia } from '@uiw/codemirror-theme-okaidia';
import { MarkdownPreview } from '../components/MarkdownPreview';
import { useCallback, useState } from 'react';
import { Card } from '../components/Card';
import { useBlogEntry } from '../hooks/use-blog-entry';
import { Loading } from '../components/Loading';
import { Input } from '../elements/Input';
import { Button } from '../elements/Button';
import { useParams } from 'react-router';

const Editor = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => {
  return (
    <>
      <CodeMirror
        value={value}
        extensions={[markdown({ base: markdownLanguage, codeLanguages: languages })]}
        theme={okaidia}
        onChange={onChange}
      />
    </>
  );
};

export default function WhiteWindPage() {
  const params = useParams<{ rkey: string }>();
  const rkey = params.rkey;
  const { data, isLoading } = useBlogEntry({ author: 'imlunahey.com', rkey });
  const [value, setValue] = useState(data?.value.content ?? '');
  const onChange = useCallback((value: string) => {
    setValue(value);
  }, []);

  if (isLoading) return <Loading />;

  return (
    <>
      <Editor value={value} onChange={onChange} />
      <Card>
        <Input placeholder="Comments link" value={data?.value.comments} />
        <Button>Save</Button>
      </Card>
      <MarkdownPreview content={value} />
    </>
  );
}
