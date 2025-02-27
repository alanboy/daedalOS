import StyledVim from "components/apps/Vim/StyledVim";
import type { QueueItem } from "components/apps/Vim/types";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import useFileDrop from "components/system/Files/FileManager/useFileDrop";
import useTitle from "components/system/Window/useTitle";
import { useFileSystem } from "contexts/fileSystem";
import { useProcesses } from "contexts/process";
import { basename, dirname } from "path";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_TEXT_FILE_SAVE_PATH } from "utils/constants";
import { loadFiles } from "utils/functions";

const Vim: FC<ComponentProcessProps> = ({ id }) => {
  const {
    closeWithTransition,
    processes: { [id]: process },
  } = useProcesses();
  const { readFile, updateFolder, writeFile } = useFileSystem();
  const { prependFileToTitle } = useTitle(id);
  const { url = "" } = process || {};
  const [updateQueue, setUpdateQueue] = useState<QueueItem[]>([]);
  const loading = useRef(false);
  const loadVim = useCallback(async () => {
    const saveUrl = url || DEFAULT_TEXT_FILE_SAVE_PATH;
    const [, ...pathParts] = saveUrl.split("/");
    let prependPath = "";

    if (pathParts.length === 1) {
      prependPath = "/root";
    }

    window.VimWrapperModule = {};

    await loadFiles(
      ["/Program Files/Vim.js/vim.js"],
      false,
      !!window.VimWrapperModule
    );

    window.VimWrapperModule?.init?.({
      VIMJS_ALLOW_EXIT: true,
      arguments: [`${prependPath}${saveUrl}`],
      memoryInitializerPrefixURL: "/Program Files/Vim.js/",
      postRun: [
        () => {
          loading.current = false;
        },
      ],
      preRun: [
        () => {
          let walkedPath = "";

          [prependPath, ...pathParts].forEach(
            (pathPart, index, { [index + 1]: nextPart }) => {
              if (nextPart && index + 1 !== pathParts.length) {
                window.VimWrapperModule?.VimModule?.FS_createPath?.(
                  walkedPath,
                  nextPart,
                  true,
                  true
                );
                walkedPath += `/${nextPart}`;
              } else if (!walkedPath) {
                walkedPath = pathPart;
              } else {
                const createDataFile = (data = Buffer.from("")): void =>
                  window.VimWrapperModule?.VimModule?.FS_createDataFile?.(
                    walkedPath,
                    pathPart,
                    data,
                    true,
                    true
                  );

                if (!url) {
                  createDataFile();
                } else {
                  readFile(saveUrl).then((data) => createDataFile(data));
                }
              }
            }
          );
        },
      ],
      print: console.info,
      printErr: console.info,
      quitCallback: () => closeWithTransition(id),
      writeCallback: (data) =>
        setUpdateQueue((currentQueue) => [
          ...currentQueue,
          {
            buffer: Buffer.from(data),
            url: saveUrl,
          },
        ]),
    });

    prependFileToTitle(basename(saveUrl));
  }, [closeWithTransition, id, prependFileToTitle, readFile, url]);

  useEffect(() => {
    if (updateQueue.length > 0) {
      [...updateQueue].forEach(({ buffer, url: saveUrl }) => {
        writeFile(saveUrl, buffer, true);
        updateFolder(dirname(saveUrl), basename(saveUrl));
      });
      setUpdateQueue([]);
    }
  }, [updateFolder, updateQueue, writeFile]);

  useEffect(() => {
    if (!loading.current) {
      loading.current = true;
      loadVim();
    }

    return () => {
      if (
        !loading &&
        window.VimWrapperModule?.VimModule?.asmLibraryArg?._vimjs_prepare_exit()
      ) {
        window.VimWrapperModule?.VimModule?.exit?.();
      }
    };
  }, [loadVim]);

  return (
    <StyledVim>
      <div id="vimjs-container" {...useFileDrop({ id })}>
        <canvas id="vimjs-canvas" />
      </div>
      <div id="vimjs-font-test" />
    </StyledVim>
  );
};

export default Vim;
