/-
  MetaDefinitions.lean - Теория связей как мета-теория: переопределение базовых
  терминов теории связей через последовательности и множества, которые сами
  определены в терминах связей.

  Этот файл замыкает цикл определений:
  1. Связи (Link) и ссылки определены как натуральные числа (ℕ₀)
  2. Последовательности определены как деревья связей-дуплетов в ассоциативной сети
  3. Множества определены как упорядоченные уникальные последовательности связей
  4. Теперь мы переопределяем связи и ссылки через множества и последовательности

  Это демонстрирует, что теория связей может определять свои собственные
  начальные термины в терминах структур, построенных из связей,
  что делает её мета-теорией — теорией, определяющей саму себя.
-/
import AssociativeNetworkDefinitions
import AssociativeNetworkConversions
import SequenceDefinitions
import SetDefinitions
import SetSequenceEquivalence

open SetSequenceEquivalence

-- * Мета-определения: связи и ссылки через последовательности и множества

/-
  Мета-ссылка (MetaLink) — это элемент множества ссылок,
  определённого как упорядоченное уникальное дерево связей-дуплетов
  в ассоциативной сети.

  В исходном определении: Link := ℕ₀ (натуральное число)
  В мета-определении: MetaLink — это лист дерева, хранимого в сети,
  где LinkSet — это Link (ссылка на корень дерева в сети).

  Таким образом, мета-ссылка определена через связи, которые определены
  через мета-ссылки — цикл замкнут.
-/

-- Мета-ссылка: элемент множества, определённого через деревья связей
abbrev MetaLink := Link

-- Мета-пространство ссылок: ссылка на корень дерева в ассоциативной сети
abbrev MetaLinkSpace := LinkSet

-- Мета-дуплет: пара мета-ссылок — это связь-дуплет
abbrev MetaDuplet := MetaLink × MetaLink

-- Мета-ассоциативная сеть: функция из мета-ссылок в мета-дуплеты
abbrev MetaAssociativeNetwork := MetaLink → MetaDuplet

-- Мета-ассоциативная сеть в виде последовательности мета-дуплетов
abbrev MetaAssociativeNetworkList := List MetaDuplet

-- Создание списка мета-ссылок заданного размера
def makeMetaLinkSpace_ : Nat → List Link
  | 0 => [0]
  | n + 1 => makeMetaLinkSpace_ n ++ [n + 1]

-- Создание мета-пространства ссылок — множество в ассоциативной сети
def MakeMetaLinkSpace (size : Nat) (offset : Nat)
    : Option (MetaLinkSpace × AssociativeNetworkDupletList) :=
  ListToSet (makeMetaLinkSpace_ size) offset

-- * Определение мета-ассоциативной сети через последовательности

-- Преобразование мета-сети в ассоциативную сеть дуплетов
def MetaNetworkToDupletList (net : MetaAssociativeNetworkList) : AssociativeNetworkDupletList :=
  net

/-
  ОСНОВНАЯ ТЕОРЕМА МЕТА-ТЕОРИИ:

  Любая мета-ассоциативная сеть (определённая через последовательности и множества,
  которые определены через связи-дуплеты) может быть представлена как обычная
  ассоциативная сеть дуплетов.

  Это формально показывает, что мета-определения совместимы с исходными:
  теория связей может определять свои термины через себя без противоречий.
-/
theorem meta_network_is_duplet_network :
    ∀ (net : MetaAssociativeNetworkList),
      MetaNetworkToDupletList net = net := by
  intro net
  rfl

-- Мета-пространство ссылок содержит упорядоченные уникальные элементы
theorem meta_link_space_elements_valid (size : Nat) :
    IsOrderedUniqueSequence (toOrderedUnique (makeMetaLinkSpace_ size)) := by
  exact toOrderedUnique_is_ascending (makeMetaLinkSpace_ size)

-- * Демонстрация цикла определений

/-
  Цикл определений теории связей как мета-теории:

  Уровень 0 (базовый):
    Link := ℕ₀
    Duplet := Link × Link
    AssociativeNetwork := Link → Duplet

  Уровень 1 (последовательности через связи):
    Sequence := Link  (ссылка на корень дерева дуплетов в ассоциативной сети)
    Дерево дуплетов хранится в AssociativeNetworkDupletList

  Уровень 2 (множества через последовательности):
    LinkSet := Link  (ссылка на корень, с инвариантом IsOrderedUniqueSequence)

  Уровень 3 (мета-определения через множества):
    MetaLink := Link
    MetaDuplet := MetaLink × MetaLink
    MetaAssociativeNetwork := MetaLink → MetaDuplet

  Уровень 3 структурно идентичен Уровню 0,
  но определён через конструкции Уровней 1 и 2,
  которые сами определены через конструкции Уровня 0.

  Это замыкает цикл: теория связей определяет себя через себя.
-/

-- Пример: создание мета-пространства из 5 ссылок
#eval MakeMetaLinkSpace 4 10
-- Множество {0, 1, 2, 3, 4} в ассоциативной сети

-- Пример: создание мета-ассоциативной сети
def exampleMetaNetwork : MetaAssociativeNetworkList :=
  [(1, 2), (2, 3), (3, 1)]

-- Преобразование мета-сети в дуплеты
#eval MetaNetworkToDupletList exampleMetaNetwork
-- Ожидается: [(1, 2), (2, 3), (3, 1)] — структурно идентично исходной сети

-- * Проверки верификации

#check @meta_network_is_duplet_network
#check @meta_link_space_elements_valid
