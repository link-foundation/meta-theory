/-
  AssociativeNetworkConversions.lean

  Функции преобразования между различными представлениями ассоциативных сетей.
  Lean 4 перевод AssociativeNetworkConversions.v (Rocq).
-/
import AssociativeNetworkDefinitions

-- Функция преобразования TupleOfLinks в LinkList
def TupleOfLinksToLinkList {n : Nat} (v : TupleOfLinks n) : LinkList :=
  v.toList

-- Функция преобразования AssociativeNetworkTupleFunction в AssociativeNetworkLinkListFunction
def TupleFunctionToLinkListFunction {n : Nat} (a : AssociativeNetworkTupleFunction n) : AssociativeNetworkLinkListFunction :=
  fun id => TupleOfLinksToLinkList (a id)

-- Функция преобразования AssociativeNetworkTupleList в AssociativeNetworkLinkListList
def TupleListToLinkListList {n : Nat} (net : AssociativeNetworkTupleList n) : AssociativeNetworkLinkListList :=
  net.map TupleOfLinksToLinkList

-- Функция преобразования LinkList в TupleOfLinks, возвращающая option
def LinkListToTupleOfLinksOption (n : Nat) (p : LinkList) : Option (TupleOfLinks n) :=
  let arr := p.toArray
  if h : arr.size = n then
    some ⟨arr, h⟩
  else
    none

-- Функция преобразования LinkList в TupleOfLinks с использованием TupleOfLinksDefault
def LinkListToTupleOfLinks (n : Nat) (p : LinkList) : TupleOfLinks n :=
  match LinkListToTupleOfLinksOption n p with
  | none => TupleOfLinksDefault n
  | some t => t

-- Функция преобразования AssociativeNetworkLinkListFunction в AssociativeNetworkTupleFunction
def LinkListFunctionToTupleFunction {n : Nat} (net : AssociativeNetworkLinkListFunction) : AssociativeNetworkTupleFunction n :=
  fun id => match LinkListToTupleOfLinksOption n (net id) with
  | some t => t
  | none => TupleOfLinksDefault n

-- Функция преобразования AssociativeNetworkLinkListList в AssociativeNetworkTupleList
def LinkListListToTupleList {n : Nat} (net : AssociativeNetworkLinkListList) : AssociativeNetworkTupleList n :=
  net.map (LinkListToTupleOfLinks n)

-- Функция преобразования LinkList в AssociativeNetworkDupletList со смещением индексации
def LinkListToDupletList_ (offset : Nat) : LinkList → AssociativeNetworkDupletList
  | [] => []
  | [h] => [(h, offset)]
  | h :: t => (h, offset + 1) :: LinkListToDupletList_ (offset + 1) t

-- Функция преобразования LinkList в AssociativeNetworkDupletList
def LinkListToDupletList (np : LinkList) : AssociativeNetworkDupletList :=
  LinkListToDupletList_ 0 np

-- Функция добавления LinkList в хвост AssociativeNetworkDupletList
def AddLinkListToDupletList (anet : AssociativeNetworkDupletList) (np : LinkList) : AssociativeNetworkDupletList :=
  anet ++ LinkListToDupletList_ anet.length np

-- Функция отрезает голову anetd и возвращает хвост начиная с offset
def DupletListBehead (anet : AssociativeNetworkDupletList) : Nat → AssociativeNetworkDupletList
  | 0 => anet
  | Nat.succ n => match anet with
    | [] => []
    | _ :: t => DupletListBehead t n

-- Функция преобразования AssociativeNetworkDupletList в LinkList с индексацией в начале AssociativeNetworkDupletList начиная с offset
def DupletListToLinkList_ (anet : AssociativeNetworkDupletList) (offset : Nat) (index : Nat) : LinkList :=
  match anet with
  | [] => []
  | (x, next_index) :: tail_anet =>
    if offset == index then
      x :: DupletListToLinkList_ tail_anet (offset + 1) next_index
    else
      DupletListToLinkList_ tail_anet (offset + 1) index

-- Функция чтения LinkList из AssociativeNetworkDupletList по индексу дуплета
def DupletListReadLinkList (anet : AssociativeNetworkDupletList) (index : Nat) : LinkList :=
  DupletListToLinkList_ anet 0 index

-- Функция преобразования AssociativeNetworkDupletList в LinkList начиная с головы списка ассоциативной сети
def DupletListToLinkList (anet : AssociativeNetworkDupletList) : LinkList :=
  DupletListReadLinkList anet 0

-- Функция добавления AssociativeNetworkLinkListList в AssociativeNetworkDupletList
def AddLinkListListToDupletList : AssociativeNetworkDupletList → AssociativeNetworkLinkListList → AssociativeNetworkDupletList
  | anetd, [] => anetd
  | anetd, h :: t => AddLinkListListToDupletList (AddLinkListToDupletList anetd h) t

-- Функция преобразования AssociativeNetworkLinkListList в AssociativeNetworkDupletList
def LinkListListToDupletList : AssociativeNetworkLinkListList → AssociativeNetworkDupletList
  | [] => []
  | h :: t => AddLinkListListToDupletList (LinkListToDupletList h) t

-- Функция поиска LinkList в хвосте AssociativeNetworkDupletList начинающемуся с offset по её порядковому номеру.
-- Возвращает offset LinkList.
def DupletListOffsetLinkList_ (anet : AssociativeNetworkDupletList) (offset : Nat) (index : Nat) : Nat :=
  match anet with
  | [] => offset + anet.length
  | (_, next_index) :: tail_anet =>
    match index with
    | 0 => offset
    | Nat.succ index' =>
      if offset == next_index then
        DupletListOffsetLinkList_ tail_anet (offset + 1) index'
      else
        DupletListOffsetLinkList_ tail_anet (offset + 1) index

-- Функция поиска LinkList в AssociativeNetworkDupletList по её порядковому номеру. Возвращает offset LinkList.
def DupletListOffsetLinkList (anet : AssociativeNetworkDupletList) (index : Nat) : Nat :=
  DupletListOffsetLinkList_ anet 0 index

-- Функция преобразования AssociativeNetworkTupleList в AssociativeNetworkDupletList
def TupleListToDupletList {n : Nat} (anetv : AssociativeNetworkTupleList n) : AssociativeNetworkDupletList :=
  LinkListListToDupletList (TupleListToLinkListList anetv)

-- Функция отрезает первую LinkList из AssociativeNetworkDupletList и возвращает хвост
def DupletListBeheadLinkList (anet : AssociativeNetworkDupletList) (offset : Nat) : AssociativeNetworkDupletList :=
  match anet with
  | [] => []
  | (_, next_index) :: tail_anet =>
    if offset == next_index then
      tail_anet
    else
      DupletListBeheadLinkList tail_anet (offset + 1)

-- Функция преобразования LinkList и AssociativeNetworkDupletList со смещения offset в AssociativeNetworkLinkListList
def DupletListToLinkListList_ (anetd : AssociativeNetworkDupletList) (np : LinkList) (offset : Nat) : AssociativeNetworkLinkListList :=
  match anetd with
  | [] => []  -- отбрасываем LinkList даже если она недостроена
  | (x, next_index) :: tail_anet =>
    if offset == next_index then  -- конец LinkList, переходим к следующей LinkList
      (np ++ [x]) :: DupletListToLinkListList_ tail_anet [] (offset + 1)
    else  -- ещё не конец LinkList, парсим ассоциативную сеть дуплетов дальше
      DupletListToLinkListList_ tail_anet (np ++ [x]) (offset + 1)

-- Функция преобразования AssociativeNetworkDupletList в AssociativeNetworkLinkListList
def DupletListToLinkListList (anetd : AssociativeNetworkDupletList) : AssociativeNetworkLinkListList :=
  DupletListToLinkListList_ anetd [] LinkDefault
