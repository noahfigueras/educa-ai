import ReactMarkdown from "react-markdown";
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

type MarkDownProps = {
  text: string;
};

export const MarkDown: React.FC<MarkDownProps> = ({ text }) => {
  return (
<ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}
                    components={{
                      h1: ({node, ...props}) => <h1 className="text-3xl font-bold mt-6 mb-2" {...props} />,
                      h2: ({node, ...props}) => <h2 className="text-2xl font-semibold mt-5 mb-2" {...props} />,
                      h3: ({node, ...props}) => <h3 className="text-xl font-semibold mt-4 mb-2" {...props} />,
                      hr: ({node, ...props}) => (
                        <hr className="my-8 border-t border-gray-300" {...props} />
                      ),
                      li: ({ children }) => <li className="list-disc ml-6">{children}</li>,
                      ul: ({ children }) => <ul className="mb-4">{children}</ul>,
                      table: ({node, ...props}) => (
                        <table className="min-w-full border border-gray-300 shadow-sm my-4 text-sm text-left">
                          {props.children}
                        </table>
                      ),
                      thead: ({node, ...props}) => (
                        <thead className="bg-gray-100 text-gray-700 font-semibold border-b border-gray-300">
                          {props.children}
                        </thead>
                      ),
                      tr: ({node, ...props}) => (
                        <tr className="border-b border-gray-200 hover:bg-gray-50">
                          {props.children}
                        </tr>
                      ),
                      th: ({node, ...props}) => (
                        <th className="px-4 py-2 border-r last:border-r-0">
                          {props.children}
                        </th>
                      ),
                      td: ({node, ...props}) => (
                        <td className="px-4 py-2 border-r last:border-r-0">
                          {props.children}
                        </td>
                      ),
                      }}
                >
                {text}
                </ReactMarkdown>
);
}
