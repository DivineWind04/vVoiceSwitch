
import Modal from 'antd/es/modal';
import Tree from 'antd/es/tree';
import { useCoreStore, type Facility } from '../../../model';
import { useMemo, useState, type Key } from 'react';


const processSingleFacility = (fac: Facility, parentKey: string, mapd: any) => {
    if (!fac) {
        return {};
    }
    parentKey += fac.id + "-";
    const children: any = fac.positions.map(pos => {
        const val = {
            title: pos.pos,
            key: parentKey + pos.pos,
        };
        mapd[val.key] = pos;
        return val;
    });
    const cl = fac.childFacilities.map(k => processSingleFacility(k, parentKey, mapd));
    children.push(...cl);
    const ret = {
        title: fac.name,
        key: parentKey,
        children,
    };
    return ret;
};


function SettingModal({ open, setModal }: { open: boolean; setModal: (v: boolean) => void }) {
    const positionsData = useCoreStore((s: any) => s.positionData);
    const updateSelectedPosition = useCoreStore((s: any) => s.updateSelectedPositions);
    const [treeSelection, setTreeSelection] = useState<Key[]>([]);
    const [treeData, mapData] = useMemo(() => {
        const mapData: any = {};
        return [[processSingleFacility(positionsData, '', mapData)], mapData];
    }, [positionsData]);

    const onSubmit = async () => {
        const data = treeSelection.map(k => mapData[String(k)]).filter(k => k);
        updateSelectedPosition(data);
        setModal(false);
    };

    return (
        <Modal 
            title="VSCS Position Settings" 
            open={open} 
            onCancel={() => setModal(false)} 
            onOk={onSubmit}
            width={600}
            className="vscs-settings-modal"
        >
            <Tree
                checkable
                selectable={false}
                onCheck={(ks, _) => setTreeSelection(ks as Key[])}
                treeData={treeData}
            />
        </Modal>
    );
}

export default SettingModal;